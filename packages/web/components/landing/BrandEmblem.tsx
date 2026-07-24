import Image from "next/image";

/**
 * The brand emblem as the hero centrepiece — the same $FLEX globe-orbit mark that sits in the
 * navbar, shown large. This is what used to be the interactive particle {@link NetworkGlobe}: the
 * boss wanted the actual logo here, not a second, different globe.
 *
 * `token.png` is 500×500 with the "$FLEX" wordmark across its bottom ~fifth. We crop to just the
 * emblem with an `aspect-[500/392]` frame plus `object-top` (object-cover then clips the overflow),
 * so the wordmark — already carried by the "$FLEX Staking" nav lockup — doesn't repeat here.
 */
export function BrandEmblem() {
  return (
    <div className="relative mx-auto grid w-full max-w-[460px] place-items-center">
      {/* Soft lime haze so the emblem sits in space instead of floating flat on the sage. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[76%] w-[76%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/40 blur-3xl"
      />
      <div className="brand-emblem-float relative aspect-[500/392] w-full overflow-hidden">
        <Image
          src="/token.png"
          alt="$FLEX token"
          fill
          priority
          sizes="(max-width: 1024px) 80vw, 460px"
          className="object-cover object-top"
        />
      </div>
    </div>
  );
}
