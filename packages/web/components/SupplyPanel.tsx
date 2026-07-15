import fs from "fs";
import path from "path";
import { formatToken } from "@/lib/format";

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

/** Server Component — reads the on-disk supply history fresh on every request. */
export function SupplyPanel() {
  const history = readSnapshots();
  const latest = history[history.length - 1];

  if (!latest) {
    return (
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">RWD supply tracking</p>
        <p className="mt-2 text-base text-ink-body">No snapshots recorded yet.</p>
      </div>
    );
  }

  const now = Date.now();
  const totalSupply = BigInt(latest.totalSupply);
  const oldestTimestamp = new Date(history[0].timestamp).getTime();
  const daysOfHistory = Math.max(1, Math.floor((now - oldestTimestamp) / DAY_MS));

  const base7d = findBaseline(history, now, 7 * DAY_MS);
  const base30d = findBaseline(history, now, 30 * DAY_MS);

  const minted7d = base7d ? totalSupply - BigInt(base7d.totalSupply) : undefined;
  const minted30d = base30d ? totalSupply - BigInt(base30d.totalSupply) : undefined;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">Total RWD supply</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {formatToken(totalSupply)} <span className="text-lg font-semibold text-ink-body">RWD</span>
        </p>
      </div>
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">Minted, last 7 days</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {minted7d !== undefined ? (
            <>
              {formatToken(minted7d)} <span className="text-lg font-semibold text-ink-body">RWD</span>
            </>
          ) : (
            <span className="text-lg font-semibold text-ink-body">{daysOfHistory}d of history so far</span>
          )}
        </p>
      </div>
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">Minted, last 30 days</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {minted30d !== undefined ? (
            <>
              {formatToken(minted30d)} <span className="text-lg font-semibold text-ink-body">RWD</span>
            </>
          ) : (
            <span className="text-lg font-semibold text-ink-body">{daysOfHistory}d of history so far</span>
          )}
        </p>
      </div>
    </div>
  );
}
