import { Client, IdentifierKind } from "@xmtp/node-sdk";
import { Wallet, JsonRpcProvider, getBytes } from "ethers";
import { readFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
const config = JSON.parse(
  await readFile(
    process.env.NEWS_WALLET_CONFIG ||
      `${homedir()}/.config/bittrees-news/wallet.json`,
    "utf8",
  ),
);
const state = `${homedir()}/.local/state/bittrees-news/xmtp`;
await mkdir(state, { recursive: true, mode: 0o700 });
const wallet = new Wallet(config.privateKey);
const rpc = new JsonRpcProvider(config.rpc);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function api(path, data) {
  const r = await fetch(`${config.site}/api/worker/${path}`, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw Error(`Worker request failed (${r.status})`);
  return r.json();
}
let client;
while (true) {
  try {
    const resolved = await rpc
      .resolveName(config.expectedName)
      .catch(() => null);
    if (
      !config.enabled ||
      resolved?.toLowerCase() !== wallet.address.toLowerCase()
    ) {
      console.info("Wallet delivery waiting for ENS sender authorization");
      await sleep(60000);
      continue;
    }
    if (!client)
      client = await Client.create(
        {
          type: "EOA",
          getIdentifier: () => ({
            identifier: wallet.address.toLowerCase(),
            identifierKind: IdentifierKind.Ethereum,
          }),
          signMessage: async (message) =>
            getBytes(await wallet.signMessage(message)),
        },
        {
          env: "production",
          dbPath: `${state}/messages.db3`,
          dbEncryptionKey: getBytes(config.dbEncryptionKey),
          appVersion: "tbn/1.0",
          maxDbPoolSize: 2,
        },
      );
    await api("state", { sender: wallet.address, ready: true });
    for (const d of await api("destinations")) {
      const address = d.value.toLowerCase();
      const reachable =
        (
          await client.canMessage([
            { identifier: address, identifierKind: IdentifierKind.Ethereum },
          ])
        ).get(address) === true;
      await api("reachability", { id: d.id, reachable });
    }
    for (let n = 0; n < 20; n++) {
      const job = await api("claim", {});
      if (!job) break;
      // Never automatically reclaim an ambiguous send: only the durable pending outbox is eligible.
      try {
        const dm = await client.conversations.createDmWithIdentifier({
          identifier: job.value.toLowerCase(),
          identifierKind: IdentifierKind.Ethereum,
        });
        if (!(await api("validate", { id: job.id })).valid) {
          await api("ack", { id: job.id, status: "failed" });
          continue;
        }
        // Check name ownership again directly before transmission.
        if (
          (await rpc.resolveName(config.expectedName))?.toLowerCase() !==
          wallet.address.toLowerCase()
        )
          throw Error("Sender authority changed");
        const providerId = await dm.sendText(job.payload.text);
        await api("ack", { id: job.id, status: "sent", providerId });
      } catch {
        await api("ack", { id: job.id, status: "uncertain" }).catch(() => {});
        console.warn("Wallet send needs receipt reconciliation");
      }
    }
  } catch (error) {
    console.warn("Wallet worker unavailable:", error.name);
  }
  await sleep(60000);
}
