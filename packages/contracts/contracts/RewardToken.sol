// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Capped} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title RewardToken (FLEX / FLX) — capped + burnable
/// @notice The farm's reward token. Mint-on-demand up to a hard 10,000,000 cap, and burnable
///         so a deflationary mechanism (e.g. an early-exit penalty on locked staking) can
///         permanently remove supply — the mirror image of the farm's inflation.
/// @dev The contract keeps the name `RewardToken` for continuity with the deploy scripts,
///      tests and ABIs; the ERC20 metadata (FLEX / FLX) is what wallets and explorers show.
///
///      Two capabilities the previous FLX token lacked, which is why this needed a fresh
///      deploy (a deployed contract's code is immutable):
///        1. CAP — `ERC20Capped` reverts any mint that would push totalSupply past 10M. It's a
///           ceiling on supply *at any moment*, not a lifetime mint budget: burning lowers
///           totalSupply and therefore frees the farm to mint back into that room, never above
///           10M. (If the intent were "only 10M ever minted," that'd be a different design.)
///        2. BURN — `ERC20Burnable` adds public `burn`/`burnFrom`. A staking contract holding
///           staked FLX can burn a penalty slice from its own balance, cutting real supply.
///
///      The MasterChef is meant to be the sole `owner` (minter): deploy this, deploy the
///      MasterChef, then `transferOwnership(masterChef)`. Minting is owner-gated and now also
///      cap-bounded, so the owner can never exceed 10M no matter what.
contract RewardToken is ERC20, ERC20Burnable, ERC20Capped, Ownable {
    constructor(address initialOwner)
        ERC20("FLEX", "FLX")
        ERC20Capped(10_000_000 ether)
        Ownable(initialOwner)
    {}

    /// @notice Mints new reward tokens, up to the 10M cap. Restricted to the owner (MasterChef).
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @dev ERC20Capped overrides `_update` to enforce the cap on mint; disambiguate the two
    ///      inherited implementations for the compiler.
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Capped) {
        super._update(from, to, value);
    }
}
