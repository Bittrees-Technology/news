import {pool} from "./db";

export function accountDeliveryHistory(accountId: string) {
  return pool().query(`
    SELECT q.id,q.period,q.status,q.created_at,q.sent_at,q.error,d.kind,d.value,
           receipt.status AS provider_status,receipt.occurred_at AS provider_status_at
    FROM deliveries q JOIN destinations d ON d.id=q.destination_id
    LEFT JOIN LATERAL (
      SELECT e.status,e.occurred_at FROM delivery_events e
      WHERE d.kind='email' AND e.provider_id=q.provider_id
      ORDER BY e.occurred_at DESC,
        CASE e.status WHEN 'complained' THEN 4 WHEN 'bounced' THEN 3
          WHEN 'failed' THEN 3 WHEN 'suppressed' THEN 3 WHEN 'delivered' THEN 2
          WHEN 'deferred' THEN 1 ELSE 0 END DESC, e.event_id DESC
      LIMIT 1
    ) receipt ON true
    WHERE q.account_id=$1 ORDER BY q.created_at DESC,q.id DESC LIMIT 30
  `, [accountId]);
}
