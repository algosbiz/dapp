// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title WethStakingRewards
/// @notice Single-asset WETH staking pool that streams an internal reward token to stakers,
///         following the Synthetix/PancakeSwap StakingRewards distribution model.
/// @dev Security notes:
///      - All state-mutating external functions are `nonReentrant` (checks-effects-interactions
///        is also respected: balances are updated before any external token transfer).
///      - `notifyRewardAmount` pulls the reward funding via `safeTransferFrom` in the same
///        transaction (owner must `approve` first), so the contract can never announce a
///        rewardRate it does not actually hold — this closes the classic "owner forgot to fund
///        the pool" insolvency bug found in the original Synthetix contract.
///      - `recoverERC20` explicitly blocks recovering the staking token or the reward token,
///        so the owner cannot rug staked/reward funds under the guise of "recovering" tokens.
///      - `pause()` only blocks new `stake()` calls; `withdraw`, `claimReward` and `exit` always
///        remain callable so users can never be locked out of their own funds.
contract WethStakingRewards is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    /// @notice The token users stake (WETH on Robinhood Chain).
    IERC20 public immutable stakingToken;
    /// @notice The internal token distributed as staking rewards.
    IERC20 public immutable rewardsToken;

    uint256 public periodFinish;
    uint256 public rewardRate;
    uint256 public rewardsDuration = 7 days;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardAdded(uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);
    event Recovered(address indexed token, uint256 amount);

    constructor(
        address _stakingToken,
        address _rewardsToken,
        address initialOwner
    ) Ownable(initialOwner) {
        require(_stakingToken != address(0), "staking token = zero address");
        require(_rewardsToken != address(0), "rewards token = zero address");
        stakingToken = IERC20(_stakingToken);
        rewardsToken = IERC20(_rewardsToken);
    }

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored +
            (((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18) / _totalSupply);
    }

    function earned(address account) public view returns (uint256) {
        return
            (_balances[account] * (rewardPerToken() - userRewardPerTokenPaid[account])) /
            1e18 +
            rewards[account];
    }

    function getRewardForDuration() external view returns (uint256) {
        return rewardRate * rewardsDuration;
    }

    // ---------------------------------------------------------------------
    // Mutative — users
    // ---------------------------------------------------------------------

    function stake(uint256 amount) external nonReentrant whenNotPaused updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        _totalSupply += amount;
        _balances[msg.sender] += amount;
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) public nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        require(_balances[msg.sender] >= amount, "Insufficient staked balance");
        _totalSupply -= amount;
        _balances[msg.sender] -= amount;
        stakingToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function claimReward() public nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardsToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    /// @notice Withdraws the caller's entire staked balance and claims any pending reward.
    function exit() external {
        withdraw(_balances[msg.sender]);
        claimReward();
    }

    // ---------------------------------------------------------------------
    // Mutative — owner only
    // ---------------------------------------------------------------------

    /// @notice Funds and (re)starts a reward distribution period.
    /// @dev Caller must `rewardsToken.approve(stakingContract, reward)` beforehand — the reward
    ///      amount is pulled via `safeTransferFrom` so the pool's obligations can never exceed
    ///      the tokens it actually custodies.
    function notifyRewardAmount(uint256 reward) external onlyOwner updateReward(address(0)) {
        require(reward > 0, "reward = 0");
        rewardsToken.safeTransferFrom(msg.sender, address(this), reward);

        if (block.timestamp >= periodFinish) {
            rewardRate = reward / rewardsDuration;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            rewardRate = (reward + leftover) / rewardsDuration;
        }

        // Solvency check: the pool must always hold enough reward tokens to honor rewardRate
        // for the full remaining duration.
        uint256 balance = rewardsToken.balanceOf(address(this));
        require(rewardRate <= balance / rewardsDuration, "Provided reward too high");
        require(rewardRate > 0, "reward rate = 0");

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + rewardsDuration;
        emit RewardAdded(reward);
    }

    /// @notice Updates the length of future reward periods. Can only be changed once the
    ///         current period has fully elapsed, so it can never be used to cut a live period short.
    function setRewardsDuration(uint256 _rewardsDuration) external onlyOwner {
        require(block.timestamp > periodFinish, "Previous rewards period must be complete");
        require(_rewardsDuration > 0, "duration = 0");
        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(_rewardsDuration);
    }

    /// @notice Emergency stop for new stakes only. Withdraw/claim/exit stay open at all times.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Rescues ERC20 tokens accidentally sent to this contract. The staking token and
    ///         reward token can never be recovered this way, protecting user funds from the owner.
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        require(tokenAddress != address(stakingToken), "Cannot withdraw staking token");
        require(tokenAddress != address(rewardsToken), "Cannot withdraw reward token");
        IERC20(tokenAddress).safeTransfer(owner(), tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }
}
