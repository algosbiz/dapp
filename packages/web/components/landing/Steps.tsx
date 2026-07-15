const STEPS = [
  {
    n: "1",
    title: "Approve WETH",
    body: "Grant the staking contract a one-time allowance so it can move the WETH you choose to stake. You stay in control of the amount.",
  },
  {
    n: "2",
    title: "Stake any amount",
    body: "Deposit your WETH into the pool. Your position starts earning reward tokens immediately — no lock-up, no minimum.",
  },
  {
    n: "3",
    title: "Earn & claim",
    body: "Rewards stream in every second. Claim them whenever you like, or exit to withdraw your full stake and rewards in one move.",
  },
];

export function Steps() {
  return (
    <section id="how" className="scroll-mt-20 bg-canvas">
      <div className="mx-auto max-w-container px-4 py-20 sm:px-6 lg:py-24">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Staking in three steps
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-ink-body">
            The whole flow lives on-chain and takes a couple of minutes. No sign-up, no custody,
            no waiting period.
          </p>
        </div>

        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="rounded-card bg-canvas-soft p-7">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-brand font-display text-lg font-extrabold text-ink">
                {step.n}
              </span>
              <h3 className="mt-5 font-display text-xl font-bold text-ink">{step.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-ink-body">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
