import { Hero } from "@/components/landing/Hero";
import { Steps } from "@/components/landing/Steps";
import { Guarantees } from "@/components/landing/Guarantees";
import { CtaBand } from "@/components/landing/CtaBand";

export default function Home() {
  return (
    <>
      <Hero />
      <Steps />
      <Guarantees />
      <CtaBand />
    </>
  );
}
