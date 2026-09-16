"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
export async function call(
  path: string,
  body?: unknown,
  method = body ? "POST" : "GET",
) {
  const r = await fetch("/api/" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Request failed");
  return d;
}
export function Header() {
  const [signed, setSigned] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    call("account")
      .then((d) => setSigned(!!d.account))
      .catch(() => {});
    const refresh = () =>
      call("account")
        .then((d) => setSigned(!!d.account))
        .catch(() => setSigned(false));
    window.addEventListener("news-auth", refresh);
    return () => window.removeEventListener("news-auth", refresh);
  }, [pathname]);
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        TBN<span> / the bittrees news</span>
      </Link>
      <nav>
        {signed && (
          <>
            <Link href="/archive">Archive</Link>
            <Link href="/saved">Saved</Link>
          </>
        )}
        <Link className="account-link" href="/account">
          {signed ? "Your account" : "Sign in / Sign up"}
        </Link>
      </nav>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <span>A Bittrees newspaper. Three editions a day.</span>
      <div>
        <Link href="/about">About & sources</Link>
        <Link href="/privacy">Privacy</Link>
        <a href="https://github.com/Bittrees-Technology/news">Source code</a>
      </div>
    </footer>
  );
}
