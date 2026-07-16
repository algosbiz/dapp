/** Small token identity chip — colored dot + symbol. Not a selector; this app only ever has fixed pairs. */
export function TokenPill({ code, tone }: { code: string; tone: "ink" | "green" }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-sm font-bold text-ink shadow-sm ring-1 ring-ink/10">
      <span
        className={`h-2.5 w-2.5 rounded-full ${tone === "green" ? "bg-brand" : "bg-ink"}`}
        aria-hidden="true"
      />
      {code}
    </span>
  );
}
