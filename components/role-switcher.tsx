'use client';
import {useEffect,useState} from 'react';
import {call,reloadForRoleChange} from '@/lib/browser-api';
export function RoleSwitcher(){
 const [account,setAccount]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;void call('session').then(d=>{if(active)setAccount(d.account);}).catch(()=>{});return()=>{active=false;};},[]);
 if(!account||!Array.isArray(account.availableRoles)||account.availableRoles.length<2)return null;
 return <section><h3>Working role</h3><label>Choose your account permissions <select value={account.role} disabled={busy} onChange={async e=>{setBusy(true);setError('');try{await call('session/role',{role:e.target.value});reloadForRoleChange();}catch(err){setError((err as Error).message);setBusy(false);}}}>{account.availableRoles.map((r:string)=><option key={r} value={r}>{r.replaceAll('_','-')}</option>)}</select></label>{error&&<p role="alert">{error}</p>}</section>;
}
