// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title WethRwdPool
/// @notice Minimal constant-product AMM for exactly one pair: WETH (token0) and RWD (token1).
///         Not a generic multi-pair DEX — purpose-built for this one pool, no factory/router.
///         The contract itself IS the LP token (ERC20 + ERC20Burnable).
/// @dev Security notes:
///      - `addLiquidity`/`removeLiquidity`/`swap` are all `nonReentrant`.
///      - `addLiquidity`/`removeLiquidity` follow strict checks-effects-interactions.
///      - `swap` measures the actually-received input via a balanceOf delta rather than
///        trusting the `amountIn` parameter, matching real Uniswap V2 behavior.
///      - `reserve0`/`reserve1` are internal accounting state updated only by this contract's
///        own logic — never read from a bare `balanceOf(address(this))`. A direct token
///        donation to this contract cannot skew LP-share math or pricing; it just sits as
///        unaccounted (and, by design, unrecoverable — see `recoverERC20`) dust.
///      - `pause()` blocks new `addLiquidity`/`swap` only; `removeLiquidity` always stays
///        open so LPs can never be locked out of their own funds.
///      - `recoverERC20` blocks recovering token0/token1, so the owner cannot rug pool
///        reserves under the guise of "recovering" tokens.
///      - Assumes token0/token1 are standard, non-fee-on-transfer 18-decimal ERC20s (true
///        for WETH and RWD here) — `addLiquidity`/`removeLiquidity` do not defend against
///        fee-on-transfer tokens (only `swap`'s input side does, via the balance delta).
///
///      Founding-liquidity lock: there is no special in-contract "first LP" path. Whoever
///      seeds the first deposit receives LP tokens like any other depositor; if that
///      liquidity is meant to be permanently locked (never withdrawable by anyone), the
///      depositor separately calls the inherited `burn(uint256)` on their own LP balance.
///      `removeLiquidity()` burns LP AND pays out the underlying reserves (a normal exit);
///      `burn()` destroys LP WITHOUT paying out anything — that's what makes a burned
///      share's reserves permanently irredeemable. The pool keeps working normally for
///      everyone else afterward; only the burned share is gone forever.
contract WethRwdPool is ERC20, ERC20Burnable, ReentrancyGuard, Ownable2Step, Pausable {
    using SafeERC20 for IERC20;

    /// @notice WETH.
    IERC20 public immutable token0;
    /// @notice RWD.
    IERC20 public immutable token1;

    uint256 public reserve0;
    uint256 public reserve1;

    /// @notice Permanently locked on the first deposit to protect later depositors from
    ///         rounding-error griefing on a too-small first deposit. Minted to `DEAD_ADDRESS`
    ///         since OpenZeppelin's `_mint` reverts on the zero address.
    uint256 public constant MINIMUM_LIQUIDITY = 1000;
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    /// @notice Swap fee in basis points (30 = 0.3%), taken from the input and left in the
    ///         pool, accruing to all LPs proportionally.
    uint256 public constant SWAP_FEE_BPS = 30;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    event LiquidityAdded(address indexed provider, uint256 amount0, uint256 amount1, uint256 liquidity);
    event LiquidityRemoved(address indexed provider, uint256 liquidity, uint256 amount0, uint256 amount1);
    event Swap(
        address indexed sender,
        address indexed tokenIn,
        uint256 amountIn,
        address indexed tokenOut,
        uint256 amountOut,
        address to
    );
    event Sync(uint256 reserve0, uint256 reserve1);
    event Recovered(address indexed token, uint256 amount);

    constructor(
        address _token0,
        address _token1,
        address initialOwner
    ) ERC20("WETH-RWD LP Token", "WETH-RWD-LP") Ownable(initialOwner) {
        require(_token0 != address(0), "token0 = zero address");
        require(_token1 != address(0), "token1 = zero address");
        require(_token0 != _token1, "token0 = token1");
        token0 = IERC20(_token0);
        token1 = IERC20(_token1);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getReserves() public view returns (uint256 _reserve0, uint256 _reserve1) {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
    }

    /// @notice Pure constant-product quote for a swap of `amountIn` given current reserves,
    ///         after the swap fee. Does not touch state.
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256) {
        require(amountIn > 0, "amountIn = 0");
        require(reserveIn > 0 && reserveOut > 0, "insufficient liquidity");
        uint256 amountInWithFee = amountIn * (BPS_DENOMINATOR - SWAP_FEE_BPS);
        return (amountInWithFee * reserveOut) / (reserveIn * BPS_DENOMINATOR + amountInWithFee);
    }

    // ---------------------------------------------------------------------
    // Liquidity
    // ---------------------------------------------------------------------

    /// @notice Deposits token0/token1 in the pool ratio (or seeds the pool if empty) and
    ///         mints LP tokens proportional to the contribution.
    function addLiquidity(
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min
    ) external nonReentrant whenNotPaused returns (uint256 amount0, uint256 amount1, uint256 liquidity) {
        require(amount0Desired > 0 && amount1Desired > 0, "amount = 0");

        uint256 _reserve0 = reserve0;
        uint256 _reserve1 = reserve1;
        uint256 _totalSupply = totalSupply();

        if (_totalSupply == 0) {
            amount0 = amount0Desired;
            amount1 = amount1Desired;
            uint256 sqrtLiquidity = Math.sqrt(amount0 * amount1);
            require(sqrtLiquidity > MINIMUM_LIQUIDITY, "insufficient initial liquidity");
            liquidity = sqrtLiquidity - MINIMUM_LIQUIDITY;
            _mint(DEAD_ADDRESS, MINIMUM_LIQUIDITY);
        } else {
            (amount0, amount1) = _computeOptimalAmounts(
                amount0Desired,
                amount1Desired,
                amount0Min,
                amount1Min,
                _reserve0,
                _reserve1
            );
            liquidity = Math.min(
                (amount0 * _totalSupply) / _reserve0,
                (amount1 * _totalSupply) / _reserve1
            );
            require(liquidity > 0, "insufficient liquidity minted");
        }

        // Effects before interactions.
        _mint(msg.sender, liquidity);
        _update(_reserve0 + amount0, _reserve1 + amount1);

        // Interactions.
        token0.safeTransferFrom(msg.sender, address(this), amount0);
        token1.safeTransferFrom(msg.sender, address(this), amount1);

        emit LiquidityAdded(msg.sender, amount0, amount1, liquidity);
    }

    /// @notice Burns `liquidity` LP tokens and pays out the caller's proportional share of
    ///         the reserves. Always callable, even while paused, so LPs can never be locked
    ///         out of their own funds.
    function removeLiquidity(
        uint256 liquidity,
        uint256 amount0Min,
        uint256 amount1Min
    ) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        require(liquidity > 0, "liquidity = 0");

        uint256 _totalSupply = totalSupply();
        uint256 _reserve0 = reserve0;
        uint256 _reserve1 = reserve1;

        amount0 = (liquidity * _reserve0) / _totalSupply;
        amount1 = (liquidity * _reserve1) / _totalSupply;
        require(amount0 > 0 && amount1 > 0, "insufficient liquidity burned");
        require(amount0 >= amount0Min, "insufficient token0 amount");
        require(amount1 >= amount1Min, "insufficient token1 amount");

        // Effects before interactions.
        _burn(msg.sender, liquidity);
        _update(_reserve0 - amount0, _reserve1 - amount1);

        // Interactions.
        token0.safeTransfer(msg.sender, amount0);
        token1.safeTransfer(msg.sender, amount1);

        emit LiquidityRemoved(msg.sender, liquidity, amount0, amount1);
    }

    /// @dev Computes the actual amounts to pull for a non-first deposit, preserving the
    ///      existing reserve ratio (mirrors Uniswap V2 router's `_addLiquidity`).
    function _computeOptimalAmounts(
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min,
        uint256 _reserve0,
        uint256 _reserve1
    ) private pure returns (uint256 amount0, uint256 amount1) {
        uint256 amount1Optimal = (amount0Desired * _reserve1) / _reserve0;
        if (amount1Optimal <= amount1Desired) {
            require(amount1Optimal >= amount1Min, "insufficient token1 amount");
            amount0 = amount0Desired;
            amount1 = amount1Optimal;
        } else {
            uint256 amount0Optimal = (amount1Desired * _reserve0) / _reserve1;
            require(amount0Optimal >= amount0Min, "insufficient token0 amount");
            amount0 = amount0Optimal;
            amount1 = amount1Desired;
        }
    }

    // ---------------------------------------------------------------------
    // Swap
    // ---------------------------------------------------------------------

    /// @dev Bundled in a memory struct (rather than separate locals) so `swap` stays under
    ///      the EVM stack-depth limit without needing `viaIR`.
    struct SwapState {
        bool zeroForOne;
        IERC20 tokenInErc;
        IERC20 tokenOutErc;
        uint256 reserveIn;
        uint256 reserveOut;
        uint256 kBefore;
        uint256 amountOut;
    }

    /// @notice Swaps exactly `amountIn` of `tokenIn` (token0 or token1) for the other token,
    ///         reverting if the output would be below `amountOutMin`.
    function swap(
        uint256 amountIn,
        address tokenIn,
        uint256 amountOutMin,
        address to
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(amountIn > 0, "amountIn = 0");
        require(to != address(0), "to = zero address");
        require(tokenIn == address(token0) || tokenIn == address(token1), "invalid tokenIn");

        SwapState memory s;
        s.zeroForOne = tokenIn == address(token0);
        (s.tokenInErc, s.tokenOutErc) = s.zeroForOne ? (token0, token1) : (token1, token0);
        (s.reserveIn, s.reserveOut) = s.zeroForOne ? (reserve0, reserve1) : (reserve1, reserve0);
        s.kBefore = s.reserveIn * s.reserveOut;

        // Measure the actual amount received rather than trusting `amountIn` — defends
        // against any transfer-amount discrepancy and guarantees reserve accounting always
        // matches real custody. Safe under `nonReentrant` even though this external call
        // precedes the rest of this function's effects.
        uint256 balanceInBefore = s.tokenInErc.balanceOf(address(this));
        s.tokenInErc.safeTransferFrom(msg.sender, address(this), amountIn);
        amountIn = s.tokenInErc.balanceOf(address(this)) - balanceInBefore;

        s.amountOut = getAmountOut(amountIn, s.reserveIn, s.reserveOut);
        require(s.amountOut >= amountOutMin, "slippage: amountOut < amountOutMin");
        require(s.amountOut < s.reserveOut, "insufficient liquidity");

        if (s.zeroForOne) {
            _update(s.reserveIn + amountIn, s.reserveOut - s.amountOut);
        } else {
            _update(s.reserveOut - s.amountOut, s.reserveIn + amountIn);
        }

        // Defense-in-depth: the math above already guarantees this, but assert it anyway.
        require(reserve0 * reserve1 >= s.kBefore, "invariant violated");

        s.tokenOutErc.safeTransfer(to, s.amountOut);

        emit Swap(msg.sender, tokenIn, amountIn, address(s.tokenOutErc), s.amountOut, to);
        return s.amountOut;
    }

    function _update(uint256 balance0, uint256 balance1) private {
        reserve0 = balance0;
        reserve1 = balance1;
        emit Sync(reserve0, reserve1);
    }

    // ---------------------------------------------------------------------
    // Owner
    // ---------------------------------------------------------------------

    /// @notice Emergency stop for new liquidity/swaps only. `removeLiquidity` stays open.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Rescues ERC20 tokens accidentally sent to this contract. token0/token1 can
    ///         never be recovered this way, protecting pool reserves from the owner.
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        require(tokenAddress != address(token0), "Cannot withdraw token0");
        require(tokenAddress != address(token1), "Cannot withdraw token1");
        IERC20(tokenAddress).safeTransfer(owner(), tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }
}
