/**
 * Shared guard for the scheduled routes.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when the env var is set. Without a
 * check, these URLs are public and anyone could spam the boss's Telegram with reports (or
 * burn the RPC quota) just by hitting them in a loop.
 *
 * Manual runs are supported with `?secret=...` so a route can be triggered from a browser
 * while setting things up.
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;

  // Unset secret = not yet configured. Allowed, so the routes are testable before setup, but
  // every caller reports `unprotected: true` so this can't be shipped unnoticed.
  if (!secret) return true;

  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

export function cronIsUnprotected(): boolean {
  return !process.env.CRON_SECRET;
}
