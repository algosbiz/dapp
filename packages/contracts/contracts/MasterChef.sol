// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {RewardToken} from "./RewardToken.sol";

/// @title MasterChef
/// @notice Classic SushiSwap/PancakeSwap-style multi-pool farm. Stakers deposit an LP or
///         single-asset token (e.g. WETH) and earn `rewardPerSecond` RWD, split across pools
///         by allocation points. Rewards are MINTED on demand from an uncapped RewardToken,
///         so the emission never runs out (unlike a pre-funded Synthetix pool).
///         Emission is time-based (`block.timestamp`), not block-based: on Arbitrum Orbit L2s
///         `block.number` tracks the parent chain and advances too slowly to meter rewards.
/// @dev Hardening over the original MasterChef:
///      - `deposit`/`withdraw`/`emergencyWithdraw` are `nonReentrant` and follow
///        checks-effects-interactions (state written before any token transfer).
///      - `add` rejects duplicate pools for the same token (the classic double-count bug).
///      - `SafeERC20` everywhere; `safeRewardTransfer` caps payouts at the contract balance.
///      - `Ownable2Step` so a fat-fingered ownership transfer can't brick admin control.
contract MasterChef is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Per-user position in a pool.
    struct UserInfo {
        uint256 amount; // LP tokens the user has staked
        uint256 rewardDebt; // reward accounting checkpoint (see pendingReward)
    }

    /// @notice Per-pool emission accounting.
    struct PoolInfo {
        IERC20 lpToken; // token staked in this pool
        uint256 allocPoint; // this pool's share of rewardPerSecond
        uint256 lastRewardTime; // last timestamp rewards were accounted for
        uint256 accRewardPerShare; // accumulated RWD per staked token, scaled by ACC_PRECISION
    }

    uint256 private constant ACC_PRECISION = 1e12;

    /// @notice The uncapped reward token this farm mints.
    RewardToken public immutable reward;
    /// @notice RWD minted per second, split across all pools by allocPoint.
    uint256 public rewardPerSecond;
    /// @notice Timestamp from which rewards begin accruing.
    uint256 public immutable startTimestamp;

    PoolInfo[] public poolInfo;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    /// @notice Guards against adding the same token as two pools.
    mapping(address => bool) public isPoolToken;
    /// @notice Sum of every pool's allocPoint.
    uint256 public totalAllocPoint;

    event PoolAdded(uint256 indexed pid, address indexed lpToken, uint256 allocPoint);
    event PoolSet(uint256 indexed pid, uint256 allocPoint);
    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event RewardPaid(address indexed user, uint256 indexed pid, uint256 amount);
    event EmissionRateUpdated(uint256 rewardPerSecond);
    event OwnerMint(address indexed to, uint256 amount);

    constructor(
        RewardToken _reward,
        uint256 _rewardPerSecond,
        uint256 _startTimestamp,
        address initialOwner
    ) Ownable(initialOwner) {
        require(address(_reward) != address(0), "reward = zero address");
        reward = _reward;
        rewardPerSecond = _rewardPerSecond;
        startTimestamp = _startTimestamp == 0 ? block.timestamp : _startTimestamp;
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    /// @notice Reward-eligible seconds between `from` and `to`.
    function getMultiplier(uint256 from, uint256 to) public pure returns (uint256) {
        return to - from;
    }

    /// @notice RWD claimable by `account` in pool `pid` right now (view-only, no mint).
    function pendingReward(uint256 pid, address account) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[pid];
        UserInfo storage user = userInfo[pid][account];
        uint256 accRewardPerShare = pool.accRewardPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));

        if (block.timestamp > pool.lastRewardTime && lpSupply != 0 && totalAllocPoint != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardTime, block.timestamp);
            uint256 poolReward = (multiplier * rewardPerSecond * pool.allocPoint) / totalAllocPoint;
            accRewardPerShare += (poolReward * ACC_PRECISION) / lpSupply;
        }
        return (user.amount * accRewardPerShare) / ACC_PRECISION - user.rewardDebt;
    }

    // ---------------------------------------------------------------------
    // Owner — pool management
    // ---------------------------------------------------------------------

    /// @notice Adds a new pool. `_lpToken` must not already have a pool.
    /// @param _withUpdate settle every existing pool first (recommended when pools exist).
    function add(uint256 _allocPoint, IERC20 _lpToken, bool _withUpdate) external onlyOwner {
        require(address(_lpToken) != address(0), "lpToken = zero address");
        require(!isPoolToken[address(_lpToken)], "pool already exists");
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardTime = block.timestamp > startTimestamp ? block.timestamp : startTimestamp;
        totalAllocPoint += _allocPoint;
        isPoolToken[address(_lpToken)] = true;
        poolInfo.push(
            PoolInfo({
                lpToken: _lpToken,
                allocPoint: _allocPoint,
                lastRewardTime: lastRewardTime,
                accRewardPerShare: 0
            })
        );
        emit PoolAdded(poolInfo.length - 1, address(_lpToken), _allocPoint);
    }

    /// @notice Updates a pool's allocation points.
    function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) external onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint - poolInfo[_pid].allocPoint + _allocPoint;
        poolInfo[_pid].allocPoint = _allocPoint;
        emit PoolSet(_pid, _allocPoint);
    }

    /// @notice Changes the global emission rate. Settles all pools first so past rewards
    ///         accrue at the old rate.
    function updateEmissionRate(uint256 _rewardPerSecond) external onlyOwner {
        massUpdatePools();
        rewardPerSecond = _rewardPerSecond;
        emit EmissionRateUpdated(_rewardPerSecond);
    }

    /// @notice Escape hatch for the owner to mint RWD directly — e.g. to seed a treasury
    ///         or fund a separate reward pool — without going through pool accrual.
    function ownerMint(address to, uint256 amount) external onlyOwner {
        reward.mint(to, amount);
        emit OwnerMint(to, amount);
    }

    // ---------------------------------------------------------------------
    // Reward accounting
    // ---------------------------------------------------------------------

    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    /// @notice Mints this pool's rewards up to the current timestamp and rolls them into
    ///         `accRewardPerShare`.
    function updatePool(uint256 pid) public {
        PoolInfo storage pool = poolInfo[pid];
        if (block.timestamp <= pool.lastRewardTime) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0 || pool.allocPoint == 0 || totalAllocPoint == 0) {
            pool.lastRewardTime = block.timestamp;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardTime, block.timestamp);
        uint256 poolReward = (multiplier * rewardPerSecond * pool.allocPoint) / totalAllocPoint;
        pool.lastRewardTime = block.timestamp;
        if (poolReward > 0) {
            reward.mint(address(this), poolReward);
            pool.accRewardPerShare += (poolReward * ACC_PRECISION) / lpSupply;
        }
    }

    // ---------------------------------------------------------------------
    // Staker actions
    // ---------------------------------------------------------------------

    /// @notice Stakes `amount` of pool `pid`'s token, harvesting any pending reward first.
    function deposit(uint256 pid, uint256 amount) external nonReentrant {
        PoolInfo storage pool = poolInfo[pid];
        UserInfo storage user = userInfo[pid][msg.sender];
        updatePool(pid);

        uint256 pending = (user.amount * pool.accRewardPerShare) / ACC_PRECISION - user.rewardDebt;

        if (amount > 0) {
            pool.lpToken.safeTransferFrom(msg.sender, address(this), amount);
            user.amount += amount;
        }
        user.rewardDebt = (user.amount * pool.accRewardPerShare) / ACC_PRECISION;

        if (pending > 0) {
            _safeRewardTransfer(msg.sender, pending);
            emit RewardPaid(msg.sender, pid, pending);
        }
        emit Deposit(msg.sender, pid, amount);
    }

    /// @notice Withdraws `amount` of staked tokens, harvesting any pending reward first.
    function withdraw(uint256 pid, uint256 amount) external nonReentrant {
        PoolInfo storage pool = poolInfo[pid];
        UserInfo storage user = userInfo[pid][msg.sender];
        require(user.amount >= amount, "insufficient staked balance");
        updatePool(pid);

        uint256 pending = (user.amount * pool.accRewardPerShare) / ACC_PRECISION - user.rewardDebt;

        // Effects before interactions.
        user.amount -= amount;
        user.rewardDebt = (user.amount * pool.accRewardPerShare) / ACC_PRECISION;

        if (pending > 0) {
            _safeRewardTransfer(msg.sender, pending);
            emit RewardPaid(msg.sender, pid, pending);
        }
        if (amount > 0) {
            pool.lpToken.safeTransfer(msg.sender, amount);
        }
        emit Withdraw(msg.sender, pid, amount);
    }

    /// @notice Withdraws staked principal immediately, forfeiting all pending reward.
    ///         An escape hatch that stays cheap and reliable even if reward accounting fails.
    function emergencyWithdraw(uint256 pid) external nonReentrant {
        PoolInfo storage pool = poolInfo[pid];
        UserInfo storage user = userInfo[pid][msg.sender];
        uint256 amount = user.amount;

        user.amount = 0;
        user.rewardDebt = 0;

        if (amount > 0) {
            pool.lpToken.safeTransfer(msg.sender, amount);
        }
        emit EmergencyWithdraw(msg.sender, pid, amount);
    }

    /// @dev Pays out reward, capped at the contract's balance to tolerate any rounding dust.
    function _safeRewardTransfer(address to, uint256 amount) internal {
        uint256 balance = reward.balanceOf(address(this));
        uint256 payout = amount > balance ? balance : amount;
        IERC20(address(reward)).safeTransfer(to, payout);
    }
}
