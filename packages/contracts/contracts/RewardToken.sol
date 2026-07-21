// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title RewardToken (FLEX / FLX)
/// @notice Uncapped, mintable ERC20 distributed as farming rewards by the MasterChef.
/// @dev The contract is still named `RewardToken` for continuity with the deploy scripts,
///      tests and ABIs; the ERC20 metadata below is what wallets and explorers display.
/// @dev "Unlimited supply": there is no hard cap. New supply is minted on demand as
///      rewards accrue. The MasterChef contract is meant to be the sole `owner` (minter):
///      deploy this token, deploy the MasterChef, then `transferOwnership(masterChef)`.
///
///      IMPORTANT: because minting is unbounded, the owner is a critical trust point —
///      whoever controls it controls the entire reward supply. Keep it owned by the
///      MasterChef (a contract), never an EOA, once wired up.
contract RewardToken is ERC20, Ownable {
    constructor(address initialOwner) ERC20("FLEX", "FLX") Ownable(initialOwner) {}

    /// @notice Mints new reward tokens. Restricted to the owner (the MasterChef).
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
