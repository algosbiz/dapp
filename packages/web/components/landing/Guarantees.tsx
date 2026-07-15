import type { ReactNode } from "react";

export function Guarantees() {
  return (
    <section id="security" className="scroll-mt-20">
      <div className="mx-auto max-w-container px-4 py-20 sm:px-6 lg:py-24">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Built to protect your funds
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-ink-body">
            The contract follows the battle-tested Synthetix reward model, with the well-known
            failure modes closed off. Here is what that means for you.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {/* Wide dark card — the headline guarantee */}
          <div className="rounded-card bg-ink p-7 lg:col-span-2">
            <IconBadge wrapper="bg-brand/15" color="#9fe870">
              <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              <path d="M9 12l2 2 4-4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </IconBadge>
            <h3 className="mt-5 font-display text-2xl font-bold text-brand">You always keep control</h3>
            <p className="mt-2 max-w-xl text-base leading-relaxed text-canvas-soft/85">
              Withdrawing and claiming can never be paused or blocked — not even by the owner. And
              the recover-token function is explicitly barred from touching the staking token or the
              reward token, so no one can drain your position under the guise of &ldquo;recovering&rdquo;
              funds.
            </p>
          </div>

          {/* Green card — solvency */}
          <div className="rounded-card bg-brand-pale p-7">
            <IconBadge wrapper="bg-positive/15" color="#054d28">
              <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
              <path d="M12 7.5v9M9.5 10c0-1 1.1-1.7 2.5-1.7s2.5.7 2.5 1.7-1.1 1.5-2.5 1.5-2.5.7-2.5 1.7 1.1 1.7 2.5 1.7 2.5-.7 2.5-1.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </IconBadge>
            <h3 className="mt-5 font-display text-xl font-bold text-ink">Rewards are pre-funded</h3>
            <p className="mt-2 text-base leading-relaxed text-ink-body">
              Reward funding is pulled into the pool in the same transaction that announces the rate.
              The pool can never promise more than it actually holds.
            </p>
          </div>

          {/* White card — reentrancy */}
          <div className="rounded-card bg-canvas p-7 ring-1 ring-ink/5">
            <IconBadge wrapper="bg-ink/5" color="#0e0f0c">
              <path d="M7 8V6.5a5 5 0 0 1 10 0V8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              <rect x="4.5" y="8" width="15" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
              <circle cx="12" cy="13.5" r="1.6" fill="currentColor" />
            </IconBadge>
            <h3 className="mt-5 font-display text-xl font-bold text-ink">Reentrancy-guarded</h3>
            <p className="mt-2 text-base leading-relaxed text-ink-body">
              Every state-changing action is{" "}
              <code className="rounded bg-ink/5 px-1 py-0.5 text-sm">nonReentrant</code> and updates
              balances before any token transfer — checks-effects-interactions, throughout.
            </p>
          </div>

          {/* Wide sage card — pause */}
          <div className="rounded-card bg-canvas-soft p-7 ring-1 ring-ink/5 lg:col-span-2">
            <IconBadge wrapper="bg-ink/5" color="#0e0f0c">
              <rect x="5" y="4" width="4.5" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
              <rect x="14.5" y="4" width="4.5" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
            </IconBadge>
            <h3 className="mt-5 font-display text-xl font-bold text-ink">A pause that protects you</h3>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-body">
              If staking is ever paused, it only stops <em>new</em> deposits. Your existing position
              stays fully accessible — you can always withdraw your WETH and claim your rewards.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function IconBadge({
  wrapper,
  color,
  children,
}: {
  wrapper: string;
  color: string;
  children: ReactNode;
}) {
  return (
    <span className={`grid h-11 w-11 place-items-center rounded-full ${wrapper}`}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color }} aria-hidden="true">
        {children}
      </svg>
    </span>
  );
}
