import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

// Inter carries body + UI; Manrope carries the heavy display headlines — the
// open-source stand-in DESIGN.md recommends for the proprietary Wise Sans.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FLEX Staking — Put your WETH to work on Robinhood Chain",
  description:
    "Non-custodial single-asset WETH staking on Robinhood Chain. Stake WETH, earn reward tokens streamed every second, and withdraw or claim any time.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
        <Toaster
          position="bottom-right"
          gap={10}
          toastOptions={{
            unstyled: true,
            classNames: {
              toast:
                "flex items-center gap-3 rounded-card bg-canvas px-4 py-3.5 text-sm font-semibold text-ink shadow-card border border-ink/10 w-[356px]",
              title: "text-ink",
              icon: "shrink-0",
              success: "!border-positive/30",
              error: "!border-negative/30",
              loading: "!border-ink/10",
            },
          }}
        />
      </body>
    </html>
  );
}
