import { z } from "zod";

const credential = z.object({
  id: z.uuid(),
  account_id: z.uuid(),
  scopes: z
    .array(z.enum(["read", "curate", "publish", "delivery"]))
    .min(1)
    .max(4),
  expires_at: z.date(),
});
/** Called only with the credential already authenticated by the MCP boundary. */
export function connectionMetadata(value: unknown) {
  const saved = credential.parse(value);
  return {
    contractVersion: "news-mcp-connection-v1" as const,
    credentialId: saved.id,
    accountId: saved.account_id,
    scopes: [...new Set(saved.scopes)].sort(),
    expiresAt: saved.expires_at.toISOString(),
  };
}
