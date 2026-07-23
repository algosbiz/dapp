/**
 * Scheduled daily digest. Triggered by Vercel Cron (see vercel.json), and safe to hit by hand
 * with `?secret=$CRON_SECRET` to preview the message.
 *
 * `?dry=1` returns the composed text as JSON without sending it — useful for checking the
 * numbers and wording without spamming the chat.
 */

import { NextResponse } from "next/server";
import { fetchBotMetrics } from "@/lib/botMetrics";
import { buildDailyReport } from "@/lib/botFormat";
import { isTelegramConfigured, sendTelegramMessage } from "@/lib/telegram";
import { cronIsUnprotected, isAuthorizedCron } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dry") === "1";

  try {
    const metrics = await fetchBotMetrics();
    const message = buildDailyReport(metrics);

    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, message, unprotected: cronIsUnprotected() });
    }

    if (!isTelegramConfigured()) {
      // Not an error yet — the bot token simply hasn't been added. Return the message so the
      // route is still useful (and testable) before setup is finished.
      return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN not set", message });
    }

    const sent = await sendTelegramMessage(message);
    return NextResponse.json({
      ok: sent.ok,
      ...(sent.ok ? {} : { error: sent.error }),
      block: metrics.blockNumber.toString(),
      unprotected: cronIsUnprotected(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
