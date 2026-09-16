import { pool } from "./db";
export async function walletReady() {
  if (!process.env.XMTP_SENDER_ADDRESS) return false;
  const result = await pool().query(
    "SELECT data FROM worker_state WHERE id='xmtp' AND updated_at>now()-interval '5 minutes'",
  );
  const state = result.rows[0]?.data;
  return (
    state?.ready === true &&
    state.sender?.toLowerCase() ===
      process.env.XMTP_SENDER_ADDRESS.toLowerCase()
  );
}
