import { pool } from "./db";
import { HttpError } from "./model";
export function emailReady() {
  return !!process.env.RESEND_API_KEY;
}
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  id: string,
  unsubscribe?: string,
  html?: string,
) {
  if (!emailReady())
    throw new HttpError(
      503,
      "Email delivery is not available yet. Please use wallet sign-in.",
    );
  const budget = await pool().query(
    "INSERT INTO rate_limits(key,hits,resets_at) VALUES($1,1,now()+interval '1 day') ON CONFLICT(key) DO UPDATE SET hits=rate_limits.hits+1 RETURNING hits",
    ["email-budget:" + new Date().toISOString().slice(0, 10)],
  );
  if (budget.rows[0].hits > Number(process.env.DAILY_EMAIL_LIMIT || 500))
    throw new HttpError(
      429,
      "Today’s delivery limit has been reached. Please try tomorrow.",
    );
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": id,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Bittrees News <main@bittrees.org>",
      to: [to],
      subject,
      text,
      ...(html ? {html} : {}),
      ...(unsubscribe
        ? {
            headers: {
              "List-Unsubscribe": `<${unsubscribe}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }
        : {}),
    }),
  });
  if (!r.ok)
    throw new HttpError(
      503,
      "The email provider could not accept the message. Please try again later.",
    );
  return (await r.json()).id as string;
}
