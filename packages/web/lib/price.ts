/**
 * Live ETH/USD price, for converting our own on-chain WETH-denominated figures into a USD
 * headline number. This is the one external price dependency in the whole app — everything
 * else (APR, the WETH-RWD market cap, the tokenomics calculator) deliberately avoids needing
 * a USD feed by working in WETH-relative terms instead, since testnet WETH itself has no
 * real value. This fetch answers a narrower, honest question: "what would this be worth in
 * USD if RWD traded at today's real ETH price?" — the ETH/USD leg is real, the RWD/WETH leg
 * still comes from our own shallow testnet pool, so the result is a hypothetical, not a fact.
 *
 * Public CoinGecko endpoint, no API key. Cached via Next's fetch cache (60s) so page views
 * don't hammer a free rate-limited API. Returns undefined on any failure (network, rate
 * limit, unexpected shape) — callers must treat a missing price as "USD unavailable right
 * now" and fall back to the WETH figure, never block rendering on it.
 */
export async function fetchEthUsdPrice(): Promise<number | undefined> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", {
      next: { revalidate: 60 },
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { ethereum?: { usd?: number } };
    const price = data.ethereum?.usd;
    return typeof price === "number" && Number.isFinite(price) ? price : undefined;
  } catch {
    return undefined;
  }
}
