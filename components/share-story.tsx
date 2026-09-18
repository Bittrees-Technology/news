'use client';
import {useState} from 'react';
export function ShareStory({url}:{url:string}){const [status,setStatus]=useState('');return <div><button onClick={async()=>{try{if(navigator.share)await navigator.share({url});else{await navigator.clipboard.writeText(url);setStatus('Link copied');}}catch{setStatus('Copy the address from your browser to share this story.');}}}>Share briefing</button><span role="status"> {status}</span></div>;}
