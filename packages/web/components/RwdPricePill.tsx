const MOCK_RWD_PRICE_USD = 0.05;

/**
 * Static placeholder — RWD has no real market/listing yet, so there is no live USD
 * price to fetch. Swap MOCK_RWD_PRICE_USD for a real price feed once one exists.
 */
export function RwdPricePill() {
  return (
    <span
      className="hidden items-center gap-1.5 rounded-full bg-canvas-soft py-1.5 pl-3 pr-1.5 lg:inline-flex"
      title="Placeholder price for demo purposes — RWD isn't listed anywhere yet, so this isn't live market data."
      aria-label={`Illustrative price: 1 RWD is approximately $${MOCK_RWD_PRICE_USD.toFixed(2)} US dollars. This is a placeholder, not live market data.`}
    >
      <span className="text-xs font-bold text-ink">
        1 RWD ≈ ${MOCK_RWD_PRICE_USD.toFixed(2)}
      </span>
      <span className="rounded-full bg-warning-content/10 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-warning-content">
        Mock
      </span>
    </span>
  );
}
