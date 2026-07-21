// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Placeholder reward token for testing the staking flow on Robinhood Chain
///         Testnet before the real internal reward token is available. DO NOT deploy
///         this to mainnet — swap in the company's real reward token address instead.
contract TestnetRewardToken is ERC20, Ownable {
    constructor(address initialOwner) ERC20("Testnet FLEX", "tFLX") Ownable(initialOwner) {
        _mint(initialOwner, 1_000_000 ether);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
