"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import { useEffect, useState } from "react";
import { call, cachedData, connectAuthEvents } from "@/lib/browser-api";
export { call } from "@/lib/browser-api";
export function Header() {
  const pathname=usePathname();
  const inBriefings=pathname.startsWith('/briefings')||pathname.startsWith('/story/');
  const [loggingOut,setLoggingOut]=useState(false),[logoutError,setLogoutError]=useState('');
  async function logout(){
    if(loggingOut)return;setLoggingOut(true);setLogoutError('');
    try{await call('auth/logout',{});window.location.assign('/');}
    catch{setLogoutError('Could not log out. Please try again.');setLoggingOut(false);}
  }
  const [signed, setSigned] = useState(!!cachedData("session")?.account);
  useEffect(() => {
    connectAuthEvents();
    let active = true;
    const refresh = () =>
      call("session")
        .then((d) => {
          if (active) setSigned(!!d.account);
        })
        .catch(() => {
          if (active) setSigned(false);
        });
    const changed = () => {
      setSigned(false);
      void refresh();
    };
    const focus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    void refresh();
    window.addEventListener("news-auth", changed);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    const timer = window.setInterval(focus, 30000);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("news-auth", changed);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, []);
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <img
          className="brand-mark"
          src="/brand/tbn-mark.svg"
          width="34"
          height="34"
          alt=""
          aria-hidden="true"
        />
        TBN<span> / the bittrees news</span>
      </Link>
      <nav>
        <a href="/briefings" aria-label={inBriefings?"Refresh to the most recent unread briefing":"Briefings"}>{inBriefings?"Refresh":"Briefings"}</a>
        {signed && (
          <>
            <Link href="/saved">Saved</Link>
          </>
        )}
        <Link className="account-link" href="/account">
          {signed ? "Your account" : "Sign in / Sign up"}
        </Link>
        {signed&&<button disabled={loggingOut} onClick={()=>void logout()}>{loggingOut?'Logging out…':'Log out'}</button>}
        {logoutError&&<span role="alert">{logoutError}</span>}
      </nav>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <span>A Bittrees newspaper. Three editions a day.</span>
      <div>
        <a href="/rss.xml">RSS</a>
        <Link href="/about">About & sources</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <a href="https://github.com/Bittrees-Technology/news">Source code</a>
      </div>
    </footer>
  );
}
