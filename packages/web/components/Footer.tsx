import Link from "next/link";

const NETWORK_LINKS = [
  { label: "Robinhood Chain docs", href: "https://docs.robinhood.com/chain/connecting/" },
  { label: "Block explorer", href: "https://robinhoodchain.blockscout.com" },
  { label: "Protocol contracts", href: "https://docs.robinhood.com/chain/protocol-contracts/" },
];

const PRODUCT_LINKS = [
  { label: "Start staking", href: "/stake" },
  { label: "How it works", href: "/#how" },
  { label: "Security", href: "/#security" },
];

export function Footer() {
  return (
    <footer className="bg-ink text-canvas-soft">
      <div className="mx-auto max-w-container px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-control bg-brand text-base font-black text-ink">
                W
              </span>
              <span className="font-display text-base font-extrabold tracking-tight text-canvas">
                $FLEX Staking
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-canvas-soft/70">
              Non-custodial single-asset WETH staking on Robinhood Chain. Rewards stream every
              second; your funds stay yours.
            </p>
          </div>

          <FooterColumn title="Product" links={PRODUCT_LINKS} />
          <FooterColumn title="Network" links={NETWORK_LINKS} />
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-canvas-soft/15 pt-6 text-xs text-canvas-soft/60 sm:flex-row sm:items-center sm:justify-between">
          <p>Robinhood Chain · Mainnet ID 4663 · Testnet ID 46630</p>
          <p className="max-w-md sm:text-right">
            Not financial advice. Smart contracts carry risk — get an independent audit before
            committing real funds.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-bold text-canvas">{title}</h3>
      <ul className="mt-4 space-y-3 text-sm">
        {links.map((link) => {
          const external = link.href.startsWith("http");
          return (
            <li key={link.label}>
              <Link
                href={link.href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="text-canvas-soft/70 transition-colors hover:text-brand"
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
