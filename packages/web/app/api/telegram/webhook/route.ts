/**
 * Telegram webhook — handles the bot's chat commands.
 *
 * Runs as a normal serverless route, which is the whole reason this bot needs no server of its
 * own: Telegram pushes each message here, we answer, the function exits. Register the URL once
 * with setWebhook (see HANDOFF.md §32) and it stays live with the rest of the site.
 */

import { NextResponse } from "next/server";
import { fetchBotMetrics } from "@/lib/botMetrics";
import {
  buildEmissionReply,
  buildFullReport,
  buildHelpReply,
  buildLockedReply,
  buildPriceReply,
  buildSupplyReply,
} from "@/lib/botFormat";
import { allowedChatIds, isTelegramConfigured, sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

type TelegramUpdate = {
  message?: { chat?: { id?: number | string }; text?: string };
};

export async function POST(request: Request) {
  // Telegram echoes back the secret given to setWebhook. Without this check the endpoint is
  // an open URL that anyone could POST to and make the bot talk.
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const got = request.headers.get("x-telegram-bot-api-secret-token");
    if (got !== expectedSecret) {
      return NextResponse.json({ ok: false, error: "bad secret" }, { status: 401 });
    }
  }

  if (!isTelegramConfigured()) {
    // Always 200: a non-200 makes Telegram retry the same update for hours.
    return NextResponse.json({ ok: false, error: "bot not configured" });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false, error: "bad payload" });
  }

  const chatId = update.message?.chat?.id;
  const text = update.message?.text?.trim();
  if (chatId === undefined || !text) return NextResponse.json({ ok: true, skipped: "no command" });

  const allowed = allowedChatIds();
  if (allowed.length > 0 && !allowed.includes(String(chatId))) {
    // Silent: replying "not allowed" tells a prober the bot is live and worth poking at. The
    // chat id is echoed in the response body so a misconfigured allowlist is easy to debug.
    return NextResponse.json({ ok: true, skipped: "chat not allowed", chatId: String(chatId) });
  }

  // In groups, Telegram appends the bot's username: "/supply@flex_monitor_bot".
  const command = text.split(/\s+/)[0].split("@")[0].toLowerCase();

  try {
    let reply: string;
    switch (command) {
      case "/start":
      case "/help":
        reply = buildHelpReply();
        break;
      case "/supply":
        reply = buildSupplyReply(await fetchBotMetrics());
        break;
      case "/price":
        reply = buildPriceReply(await fetchBotMetrics());
        break;
      case "/emission":
      case "/emissions":
        reply = buildEmissionReply(await fetchBotMetrics());
        break;
      case "/locked":
        reply = buildLockedReply(await fetchBotMetrics());
        break;
      case "/report":
        reply = buildFullReport(await fetchBotMetrics());
        break;
      default:
        return NextResponse.json({ ok: true, skipped: "unknown command" });
    }

    const sent = await sendTelegramMessage(reply, chatId);
    return NextResponse.json({ ok: sent.ok, command });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sendTelegramMessage(`⚠️ Couldn't read the chain right now.\n\n<i>${message.slice(0, 200)}</i>`, chatId);
    return NextResponse.json({ ok: false, error: message });
  }
}

/** Lets you confirm the route is deployed by opening it in a browser. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "telegram webhook",
    configured: isTelegramConfigured(),
    allowlistSize: allowedChatIds().length,
  });
}
