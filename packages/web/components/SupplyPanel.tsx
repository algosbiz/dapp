import fs from "fs";
import path from "path";
import { createPublicClient, formatEther, http } from "viem";
import { robinhoodTestnet } from "@/config/chains";
import { erc20Abi } from "@/abi/erc20";
import { wethRwdPoolAbi } from "@/abi/wethRwdPool";
import { CONTRACTS } from "@/config/contracts";
import { APR_PRECISION, convertByPoolPrice } from "@/lib/apr";
import { formatToken, formatUsdHeadline, formatWethHeadline } from "@/lib/format";
import { fetchEthUsdPrice } from "@/lib/price";

type Snapshot = {
  timestamp: string;
  blockNumber: number;
  totalSupply: string;
};

const SNAPSHOT_FILE = path.join(process.cwd(), "data", "rwd-supply-snapshots.json");
const DAY_MS = 24 * 60 * 60 * 1000;

function readSnapshots(): Snapshot[] {
  if (!fs.existsSync(SNAPSHOT_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf-8"));
  } catch {
    return [];
  }
}

/** Closest snapshot at or before `minAgeMs` ago, so "minted in the last N days" is well defined. */
function findBaseline(history: Snapshot[], now: number, minAgeMs: number): Snapshot | undefined {
  const cutoff = now - minAgeMs;
  const eligible = history.filter((s) => new Date(s.timestamp).getTime() <= cutoff);
  return eligible[eligible.length - 1];
}

/**
 * Live on-chain totalSupply() — not the snapshot file. The snapshot only runs once a day,
 * so "current" supply shown via the snapshot's last entry can lag real mint activity (the
 * farm mints FLX continuously as rewards accrue). Historical baselines (7d/30d ago) still
 * have to come from the snapshot file — there's no way to ask a contract "what was your
 * totalSupply 7 days ago" — but "right now" should always be exact.
 */
async function fetchLiveTotalSupply(): Promise<bigint | undefined> {
  try {
    const client = createPublicClient({ chain: robinhoodTestnet, transport: http() });
    return await client.readContract({
      address: CONTRACTS.rwdToken,
      abi: erc20Abi,
      functionName: "totalSupply",
    });
  } catch {
    return undefined;
  }
}

/**
 * Market cap = totalSupply x current FLX price, both expressed in WETH — no USD price
 * needed (same trick as the APR calculations), and there is no real USD price to use
 * anyway since this is testnet WETH. Reads live pool reserves directly (not from the
 * daily snapshot file, which only tracks totalSupply) so this stays current between
 * snapshot runs.
 */
async function fetchMarketCapInWeth(totalSupply: bigint): Promise<bigint | undefined> {
  try {
    const client = createPublicClient({ chain: robinhoodTestnet, transport: http() });
    const [reserve0, reserve1] = await client.readContract({
      address: CONTRACTS.wethRwdPool,
      abi: wethRwdPoolAbi,
      functionName: "getReserves",
    });
    if (reserve1 === 0n) return undefined;
    const priceRwdInWeth = convertByPoolPrice(APR_PRECISION, reserve1, reserve0);
    return convertByPoolPrice(totalSupply, APR_PRECISION, priceRwdInWeth);
  } catch {
    return undefined;
  }
}

/** Server Component — reads the on-disk supply history + live pool price fresh on every request. */
export async function SupplyPanel() {
  const history = readSnapshots();
  const latest = history[history.length - 1];

  if (!latest) {
    return (
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">FLX supply tracking</p>
        <p className="mt-2 text-base text-ink-body">No snapshots recorded yet.</p>
      </div>
    );
  }

  const now = Date.now();
  const oldestTimestamp = new Date(history[0].timestamp).getTime();
  const daysOfHistory = Math.max(1, Math.floor((now - oldestTimestamp) / DAY_MS));

  const base7d = findBaseline(history, now, 7 * DAY_MS);
  const base30d = findBaseline(history, now, 30 * DAY_MS);

  // "Right now" always comes from a live read; only the historical baselines above are
  // allowed to be snapshot-file-old, since that's the only place they can come from.
  const [liveTotalSupply, ethUsdPrice] = await Promise.all([fetchLiveTotalSupply(), fetchEthUsdPrice()]);
  const totalSupply = liveTotalSupply ?? BigInt(latest.totalSupply);

  const minted7d = base7d ? totalSupply - BigInt(base7d.totalSupply) : undefined;
  const minted30d = base30d ? totalSupply - BigInt(base30d.totalSupply) : undefined;
  const marketCapInWeth = await fetchMarketCapInWeth(totalSupply);
  const marketCapInUsd =
    marketCapInWeth !== undefined && ethUsdPrice !== undefined
      ? Number(formatEther(marketCapInWeth)) * ethUsdPrice
      : undefined;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Total FLX supply"
        value={formatToken(totalSupply)}
        unit="FLX"
        caption="Every FLX that exists so far. This number only ever goes up."
      />
      <MetricCard
        label="Minted, last 7 days"
        value={minted7d !== undefined ? formatToken(minted7d) : "—"}
        unit={minted7d !== undefined ? "FLX" : undefined}
        caption={
          minted7d !== undefined
            ? "New FLX created over the past week."
            : `Needs 7 days of history to show — ${daysOfHistory}d recorded so far.`
        }
      />
      <MetricCard
        label="Minted, last 30 days"
        value={minted30d !== undefined ? formatToken(minted30d) : "—"}
        unit={minted30d !== undefined ? "FLX" : undefined}
        caption={
          minted30d !== undefined
            ? "New FLX created over the past month."
            : `Needs 30 days of history to show — ${daysOfHistory}d recorded so far.`
        }
      />
      <MetricCard
        label="Market cap (est.)"
        value={marketCapInUsd !== undefined ? formatUsdHeadline(marketCapInUsd) : formatWethHeadline(marketCapInWeth)}
        unit={marketCapInUsd === undefined && marketCapInWeth !== undefined ? "WETH" : undefined}
        secondaryLine={
          marketCapInUsd !== undefined ? `≈ ${formatWethHeadline(marketCapInWeth)} WETH` : undefined
        }
        caption={
          marketCapInUsd !== undefined
            ? "Supply × pool price × today's live ETH/USD rate. Hypothetical — the FLX:WETH ratio itself comes from our shallow testnet pool."
            : "Supply × live pool price. Testnet WETH has no USD value — illustrative only."
        }
      />
    </div>
  );
}

/** One stat tile: label on top, headline figure (with an optional smaller line underneath
 *  for a secondary unit, e.g. the WETH figure behind a USD headline), and a caption pinned
 *  to the card's base so every card reads at the same density regardless of caption length. */
function MetricCard({
  label,
  value,
  unit,
  secondaryLine,
  caption,
}: {
  label: string;
  value: string;
  unit?: string;
  secondaryLine?: string;
  caption: string;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-card bg-canvas p-6 shadow-card">
      <p className="text-sm font-semibold text-ink-body">{label}</p>
      <p className="mt-2 break-words text-3xl font-extrabold tracking-tight text-ink">
        {value}
        {unit && <span className="ml-1 text-lg font-semibold text-ink-body">{unit}</span>}
      </p>
      {secondaryLine && <p className="mt-1 break-words text-sm font-semibold text-ink-body">{secondaryLine}</p>}
      <p className="mt-auto pt-6 text-xs leading-relaxed text-ink-body">{caption}</p>
    </div>
  );
}
