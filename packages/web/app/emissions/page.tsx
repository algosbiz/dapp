import Link from "next/link";
import { EmissionsPanel } from "@/components/EmissionsPanel";
import { EmissionRateRequestForm } from "@/components/EmissionRateRequestForm";

export const metadata = {
  title: "Emissions & Supply | $FLEX Staking",
};

export default function EmissionsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-body transition-colors hover:text-ink"
      >
        <span aria-hidden="true">←</span> Back to home
      </Link>

      <header className="mt-5 max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-warning-content/10 px-3 py-1 text-xs font-bold text-warning-content">
          Read-only — no wallet needed
        </span>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Emissions &amp; Supply
        </h1>
        <p className="mt-2 text-pretty text-base leading-relaxed text-ink-body">
          Current FLX supply and reward-emission settings across every product, read live
          from the contracts. Nothing on this page can be changed here — these are
          owner-only settings, adjusted on request.
        </p>
      </header>

      <div className="mt-8">
        <EmissionsPanel />
      </div>

      <div className="mt-8">
        <EmissionRateRequestForm />
      </div>
    </div>
  );
}
