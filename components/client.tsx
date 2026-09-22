"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { call, cachedData, connectAuthEvents } from "@/lib/browser-api";
export { call } from "@/lib/browser-api";
export function Header() {
  const pathname=usePathname();
  const inBriefings=pathname.startsWith('/briefings')||pathname.startsWith('/story/');
  const menu=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{if(menu.current)menu.current.open=false;},[pathname]);
  useEffect(()=>{const close=(e:PointerEvent)=>{if(menu.current&&!menu.current.contains(e.target as Node))menu.current.open=false;};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
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
          if (active){setSigned(!!d.account);}
        })
        .catch(() => {
          if (active){setSigned(false);}
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
      <nav aria-label="Main navigation">
        <a href="/briefings" aria-label={inBriefings?"Refresh to the most recent unread briefing":"Briefings"}>{inBriefings?"Refresh":"Briefings"}</a>
        {signed && (
          <>
            <Link href="/saved">Saved</Link>
          </>
        )}
        {signed?<details className="account-menu" ref={menu} onKeyDown={e=>{if(e.key==='Escape'&&menu.current){menu.current.open=false;menu.current.querySelector('summary')?.focus();}}}>
          <summary className="account-link">My account</summary>
          <div className="account-menu-options">
            <Link href="/account">My newspaper</Link>
            <Link href="/account/settings">Account settings</Link>
            <button disabled={loggingOut} onClick={()=>void logout()}>{loggingOut?'Logging out…':'Log out'}</button>
            {logoutError&&<span role="alert">{logoutError}</span>}
          </div>
        </details>:<Link className="account-link" href="/account">Sign in / Sign up</Link>}
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
