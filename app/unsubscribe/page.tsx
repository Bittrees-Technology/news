"use client";
import { useState, useEffect } from "react";
import { call } from "@/components/client";
export default function Page() {
  const [status, setStatus] = useState(""),
    [params, setParams] = useState<{ id: string; token: string } | null>(null);
  useEffect(() => {
    const s = new URLSearchParams(location.search);
    setParams({ id: s.get("id") || "", token: s.get("token") || "" });
  }, []);
  return (
    <section className="panel">
      <h1>Pause digest delivery</h1>
      <p>
        This pauses the destination associated with this link. Your account and
        other destinations stay available.
      </p>
      <button
        className="primary"
        disabled={!params}
        onClick={async () => {
          try {
            const r = await call("unsubscribe", params);
            setStatus(
              r.ok
                ? "Delivery paused. You can enable it again in your account."
                : "This link is invalid. Manage delivery in your account.",
            );
          } catch (e) {
            setStatus((e as Error).message);
          }
        }}
      >
        Pause delivery
      </button>
      <p role="status">{status}</p>
    </section>
  );
}
