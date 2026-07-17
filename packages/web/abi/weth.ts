/**
 * Minimal WETH9 interface — just the wrap/unwrap entry points. Balances/allowances are
 * read via the shared erc20Abi. `deposit` is payable (send ETH, receive WETH 1:1);
 * `withdraw` burns WETH and returns the same amount of ETH.
 */
export const wethAbi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "wad", type: "uint256" }],
    outputs: [],
  },
] as const;
