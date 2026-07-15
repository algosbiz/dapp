/** Small inline spinner for busy buttons. Respects prefers-reduced-motion via the global override in globals.css. */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className={`animate-spin ${className}`}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Button label that swaps to a spinner + busy label when `busy` is true. Pair with a
 * per-action `activeLabel === "X"` check (from `useTransactionToast`) so only the button
 * the user actually clicked shows the spinner, not every button sharing one write hook.
 */
export function ButtonContent({
  busy,
  label,
  busyLabel,
}: {
  busy: boolean;
  label: string;
  busyLabel?: string;
}) {
  if (!busy) return <>{label}</>;
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <Spinner />
      {busyLabel ?? label}
    </span>
  );
}
