export const wethRwdPoolAbi = [
  {
    type: "function",
    name: "getReserves",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "_reserve0", type: "uint256" },
      { name: "_reserve1", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getAmountOut",
    stateMutability: "pure",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "reserveIn", type: "uint256" },
      { name: "reserveOut", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "token0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "token1",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "addLiquidity",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount0Desired", type: "uint256" },
      { name: "amount1Desired", type: "uint256" },
      { name: "amount0Min", type: "uint256" },
      { name: "amount1Min", type: "uint256" },
    ],
    outputs: [
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" },
      { name: "liquidity", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "removeLiquidity",
    stateMutability: "nonpayable",
    inputs: [
      { name: "liquidity", type: "uint256" },
      { name: "amount0Min", type: "uint256" },
      { name: "amount1Min", type: "uint256" },
    ],
    outputs: [
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "swap",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "tokenIn", type: "address" },
      { name: "amountOutMin", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "LiquidityAdded",
    inputs: [
      { name: "provider", type: "address", indexed: true },
      { name: "amount0", type: "uint256", indexed: false },
      { name: "amount1", type: "uint256", indexed: false },
      { name: "liquidity", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LiquidityRemoved",
    inputs: [
      { name: "provider", type: "address", indexed: true },
      { name: "liquidity", type: "uint256", indexed: false },
      { name: "amount0", type: "uint256", indexed: false },
      { name: "amount1", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Swap",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "tokenIn", type: "address", indexed: true },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "tokenOut", type: "address", indexed: true },
      { name: "amountOut", type: "uint256", indexed: false },
      { name: "to", type: "address", indexed: false },
    ],
  },
] as const;
