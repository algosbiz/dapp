// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @dev The reward/stake token is FLX, which is ERC20Burnable — we need `burn` on top of IERC20
///      so the early-exit penalty can be destroyed rather than parked in a dead address.
interface IBurnableERC20 is IERC20 {
    function burn(uint256 amount) external;
}

/// @title LockedStaking — the deflationary counterpart to the farm
/// @notice Lock FLX for a fixed term (1 / 2 / 3 months) and earn FLX at a tier APR. Leaving
///         before the term ends burns 5% of the principal — permanently cutting supply. That
///         burn is the whole point: the farm only ever mints FLX (inflation); this is the one
///         place supply can go *down*.
///
/// @dev Reward model: simple linear APR on the staked principal, `amount * apr * elapsed / year`,
///      accruing only up to the unlock time. Each position snapshots the tier's APR at stake
///      time, so later APR changes only affect new stakes, never money already committed.
///
///      Funding: pre-funded, like the Synthetix-style pools. The reward budget is whatever FLX
///      the contract holds beyond the active staked principal (`balanceOf(this) - totalStaked`),
///      topped up by the owner via `fundRewards`. Rewards are paid as `min(owed, budget)` so an
///      underfunded budget can never trap a staker's principal — they always get their FLX back,
///      just possibly less reward until the owner tops it up.
contract LockedStaking is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IBurnableERC20;

    IBurnableERC20 public immutable token;

    uint256 private constant BPS = 10_000;
    uint256 private constant YEAR = 365 days;
    uint256 public constant TIERS = 3;
    /// @notice Penalty on the principal for leaving before the term ends, in basis points (5%).
    uint256 public constant EARLY_EXIT_PENALTY_BPS = 500;

    /// @notice Lock length per tier: 1, 2, 3 months. Fixed — the tiers *are* the product.
    uint256[TIERS] public lockDurations = [30 days, 60 days, 90 days];
    /// @notice APR per tier in basis points (10% / 25% / 50%). Owner-tunable for future stakes.
    uint256[TIERS] public aprBps = [1000, 2500, 5000];
    /// @notice Minimum FLX per position, so dust positions don't clutter the list.
    uint256 public minStake = 3000 ether;

    struct Position {
        uint256 amount;
        uint256 startTime;
        uint256 unlockTime;
        uint256 aprBps; // snapshot at stake time
        bool withdrawn;
    }

    mapping(address => Position[]) private _positions;
    /// @notice Sum of all active (not-yet-withdrawn) principal. Kept separate so reward budget
    ///         accounting never dips into stakers' principal.
    uint256 public totalStaked;

    event Staked(address indexed user, uint256 indexed positionId, uint256 amount, uint8 tier, uint256 unlockTime);
    event Withdrawn(address indexed user, uint256 indexed positionId, uint256 principal, uint256 reward);
    event EarlyWithdrawn(address indexed user, uint256 indexed positionId, uint256 returned, uint256 burned);
    event RewardsFunded(uint256 amount);
    event AprUpdated(uint8 tier, uint256 aprBps);
    event MinStakeUpdated(uint256 minStake);

    constructor(address token_, address initialOwner) Ownable(initialOwner) {
        require(token_ != address(0), "token = zero");
        token = IBurnableERC20(token_);
    }

    // ---------------------------------------------------------------------
    // Staking
    // ---------------------------------------------------------------------

    /// @notice Locks `amount` FLX for `tier` (0=1mo, 1=2mo, 2=3mo). Reward accrues at the tier's
    ///         current APR, fixed for this position's lifetime.
    function stake(uint256 amount, uint8 tier) external nonReentrant {
        require(tier < TIERS, "bad tier");
        require(amount >= minStake, "below min stake");

        token.safeTransferFrom(msg.sender, address(this), amount);
        totalStaked += amount;

        uint256 unlockTime = block.timestamp + lockDurations[tier];
        _positions[msg.sender].push(
            Position({
                amount: amount,
                startTime: block.timestamp,
                unlockTime: unlockTime,
                aprBps: aprBps[tier],
                withdrawn: false
            })
        );
        emit Staked(msg.sender, _positions[msg.sender].length - 1, amount, tier, unlockTime);
    }

    /// @notice Reward accrued so far on a position, capped at the unlock time (it stops growing
    ///         once the term is served — the reward is for the committed duration, no more).
    function pendingReward(address user, uint256 positionId) public view returns (uint256) {
        Position storage p = _positions[user][positionId];
        if (p.withdrawn || p.amount == 0) return 0;
        uint256 end = block.timestamp < p.unlockTime ? block.timestamp : p.unlockTime;
        uint256 elapsed = end - p.startTime;
        return (p.amount * p.aprBps * elapsed) / (BPS * YEAR);
    }

    /// @notice Withdraw a matured position: full principal + reward, no penalty.
    function withdraw(uint256 positionId) external nonReentrant {
        Position storage p = _positions[msg.sender][positionId];
        require(!p.withdrawn, "already withdrawn");
        require(p.amount > 0, "no position");
        require(block.timestamp >= p.unlockTime, "still locked");

        uint256 principal = p.amount;
        uint256 owed = pendingReward(msg.sender, positionId);
        // Never let an underfunded reward budget block a principal withdrawal.
        uint256 budget = rewardBudget();
        uint256 reward = owed <= budget ? owed : budget;

        p.withdrawn = true;
        totalStaked -= principal;

        token.safeTransfer(msg.sender, principal + reward);
        emit Withdrawn(msg.sender, positionId, principal, reward);
    }

    /// @notice Leave before the term ends: 5% of the principal is burned (gone from supply
    ///         forever), 95% is returned, and any accrued reward is forfeited (it stays behind
    ///         as reward budget for stakers who keep their commitment).
    function withdrawEarly(uint256 positionId) external nonReentrant {
        Position storage p = _positions[msg.sender][positionId];
        require(!p.withdrawn, "already withdrawn");
        require(p.amount > 0, "no position");
        require(block.timestamp < p.unlockTime, "use withdraw");

        uint256 principal = p.amount;
        uint256 penalty = (principal * EARLY_EXIT_PENALTY_BPS) / BPS;
        uint256 returned = principal - penalty;

        p.withdrawn = true;
        totalStaked -= principal;

        token.burn(penalty); // deflation happens here
        token.safeTransfer(msg.sender, returned);
        emit EarlyWithdrawn(msg.sender, positionId, returned, penalty);
    }

    // ---------------------------------------------------------------------
    // Reward budget
    // ---------------------------------------------------------------------

    /// @notice FLX available to pay rewards = everything the contract holds beyond active
    ///         staked principal. Forfeited rewards and fresh funding both land here.
    function rewardBudget() public view returns (uint256) {
        uint256 balance = token.balanceOf(address(this));
        return balance > totalStaked ? balance - totalStaked : 0;
    }

    /// @notice Top up the reward budget (owner mints FLX via the farm, then funds it here).
    ///         Anyone may fund, but in practice it's the owner.
    function fundRewards(uint256 amount) external {
        require(amount > 0, "amount = 0");
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit RewardsFunded(amount);
    }

    /// @notice Reclaim unused reward budget (never touches staked principal).
    function withdrawRewardBudget(uint256 amount) external onlyOwner {
        require(amount <= rewardBudget(), "exceeds budget");
        token.safeTransfer(owner(), amount);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function positionCount(address user) external view returns (uint256) {
        return _positions[user].length;
    }

    function getPositions(address user) external view returns (Position[] memory) {
        return _positions[user];
    }

    // ---------------------------------------------------------------------
    // Owner config (affects future stakes only; live positions keep their snapshot)
    // ---------------------------------------------------------------------

    function setApr(uint8 tier, uint256 newAprBps) external onlyOwner {
        require(tier < TIERS, "bad tier");
        require(newAprBps <= 100_000, "apr too high"); // <= 1000% sanity bound
        aprBps[tier] = newAprBps;
        emit AprUpdated(tier, newAprBps);
    }

    function setMinStake(uint256 newMinStake) external onlyOwner {
        minStake = newMinStake;
        emit MinStakeUpdated(newMinStake);
    }
}
