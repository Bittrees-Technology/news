"use client";
import {countries,regions} from '@/lib/geography';
import {type EditionPreference} from '@/lib/top-three';
export function EditionChoice({value,onChange}:{value:EditionPreference;onChange:(p:EditionPreference)=>void}){
 return <div className="form-grid">
 <label className="field">Edition<select value={value.scope} onChange={e=>onChange({...value,scope:e.target.value as EditionPreference['scope']})}><option value="global">Global</option><option value="region">Country / region</option><option value="city">City</option></select></label>
 {value.scope!=='global'&&<label className="field">Country<select value={value.country} onChange={e=>onChange({...value,country:e.target.value,region:''})}><option value="">Choose country</option>{countries.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label>}
 {value.scope==='region'&&<label className="field">Region<select value={value.region} onChange={e=>onChange({...value,region:e.target.value,country:''})}><option value="">Choose region</option>{regions.map(r=><option key={r}>{r}</option>)}</select></label>}
 {value.scope==='city'&&<label className="field">City<input value={value.city||''} maxLength={80} onChange={e=>onChange({...value,city:e.target.value})} placeholder="City name as reported"/></label>}
 </div>;
}
