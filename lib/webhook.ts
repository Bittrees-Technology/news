import { Webhook } from "svix";
import {deliveryState} from "./delivery-events";
import {z} from "zod";
import { tx } from "./db";
import { HttpError } from "./model";
export async function emailEvent(r: Request) {
  if (!process.env.RESEND_WEBHOOK_SECRET)
    throw new HttpError(503, "Webhook not configured");
  const text = await r.text();
  if (text.length > 100000) throw new HttpError(413, "Payload too large");
  let event: { type: string; data: { email_id?: string; to?: string[] } };
  try {
    new Webhook(process.env.RESEND_WEBHOOK_SECRET).verify(text, {
      "svix-id": r.headers.get("svix-id") || "",
      "svix-timestamp": r.headers.get("svix-timestamp") || "",
      "svix-signature": r.headers.get("svix-signature") || "",
    });
    event = JSON.parse(text);
  } catch {
    throw new HttpError(401, "Invalid webhook signature");
  }
  const parsed=z.object({type:z.string().max(80),created_at:z.string().datetime().optional(),data:z.object({
    email_id:z.string().min(1).max(200),
    tags:z.unknown().optional(),
  })}).safeParse(event);
  if(!parsed.success)throw new HttpError(400,"Malformed email event");
  const status=deliveryState(parsed.data.type);
  if(!status)return {ok:true}; // Do not ingest opens/clicks or recipient payloads.
  await tx(async d=>{
    if (status === "delivered") {
      if (!parsed.data.created_at) throw new HttpError(400, "Missing delivery time");
      const providerId = parsed.data.data.email_id;
      const tag = z.object({news_delivery_id:z.uuid()}).safeParse(parsed.data.data.tags);
      // A signed receipt can arrive before the sender has saved Resend's response.
      if (tag.success) {
        const matched = await d.query(`UPDATE deliveries q SET provider_id=$2 FROM destinations dest
          WHERE q.id=$1 AND dest.id=q.destination_id AND dest.kind='email'
          AND q.status IN ('sending','sent','uncertain') AND (q.provider_id IS NULL OR q.provider_id=$2)`,
          [tag.data.news_delivery_id, providerId]);
        if (!matched.rowCount) return;
      } else {
        const matched = await d.query(`SELECT 1 FROM deliveries q JOIN destinations dest ON dest.id=q.destination_id
          WHERE q.provider_id=$1 AND dest.kind='email' LIMIT 1`, [providerId]);
        if (!matched.rowCount) return;
      }
    }
    const inserted=await d.query("INSERT INTO delivery_events(event_id,provider_id,event_type,status,occurred_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING event_id",[r.headers.get('svix-id'),parsed.data.data.email_id,parsed.data.type,status,parsed.data.created_at||new Date().toISOString()]);
    if(!inserted.rowCount)return;
    if(["bounced","complained"].includes(status)){
      const q=(await d.query("SELECT d.value FROM deliveries q JOIN destinations d ON d.id=q.destination_id WHERE q.provider_id=$1",[parsed.data.data.email_id])).rows;
      for(const {value} of q){
        await d.query("INSERT INTO suppressions(value,reason) VALUES($1,$2) ON CONFLICT(value) DO NOTHING",[value,parsed.data.type]);
        await d.query("UPDATE destinations SET enabled=false,revision=revision+1 WHERE kind='email' AND value=$1 AND enabled=true",[value]);
      }
    }
  });
  return { ok: true };
}
