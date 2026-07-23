/**
 * Thin wrapper over the Telegram Bot API.
 *
 * Messages use `parse_mode: "HTML"` rather than MarkdownV2. MarkdownV2 requires escaping
 * roughly a dozen characters (`_ * [ ] ( ) ~ ` > # + - = | { } . !`) — and our messages are
 * full of `.` and `-` from decimal amounts and dates, so a single missed escape turns into a
 * 400 from Telegram and a silently missing report. HTML needs only three characters escaped.
 */

const API_BASE = "https://api.telegram.org/bot";

/** Escapes the only three characters Telegram's HTML parse mode treats as markup. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type TelegramResult = { ok: true } | { ok: false; error: string };

/** True when the bot has been configured — lets routes answer "not set up yet" instead of failing. */
export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

/**
 * Sends a message. `chatId` defaults to TELEGRAM_CHAT_ID, which is what the scheduled reports
 * use; the webhook passes the incoming chat's id so replies go back where they came from.
 *
 * Never throws: a monitoring bot that crashes its caller is worse than one that misses a
 * message, and the cron routes report the failure in their own response body instead.
 */
export async function sendTelegramMessage(
  text: string,
  chatId?: string | number
): Promise<TelegramResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const target = chatId ?? process.env.TELEGRAM_CHAT_ID;

  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN is not set" };
  if (!target) return { ok: false, error: "TELEGRAM_CHAT_ID is not set" };

  try {
    const res = await fetch(`${API_BASE}${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: target,
        text,
        parse_mode: "HTML",
        // Link previews would attach a card for the explorer URLs and bury the numbers.
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Telegram API ${res.status}: ${body.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Chat ids allowed to issue commands. Defaults to TELEGRAM_CHAT_ID alone; set
 * TELEGRAM_ALLOWED_CHAT_IDS to a comma-separated list to permit more (e.g. a group plus the
 * boss's DM). The reported data is public on-chain either way — this mainly stops strangers
 * who stumble on the bot from burning our RPC quota.
 */
export function allowedChatIds(): string[] {
  const extra = process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? "";
  const ids = [process.env.TELEGRAM_CHAT_ID ?? "", ...extra.split(",")]
    .map((id) => id.trim())
    .filter(Boolean);
  return Array.from(new Set(ids));
}
