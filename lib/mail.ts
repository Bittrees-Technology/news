import {HttpError} from './model';
export function emailReady(){return !!process.env.RESEND_API_KEY;}
export async function sendEmail(to:string,subject:string,text:string,id:string,unsubscribe?:string){
 if(!emailReady())throw new HttpError(503,'Email delivery is not available yet. Please use wallet sign-in.');
 const r=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify({from:process.env.EMAIL_FROM||'Bittrees News <main@bittrees.org>',to:[to],subject,text,...(unsubscribe?{headers:{'List-Unsubscribe':`<${unsubscribe}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}}:{})})});
 if(!r.ok)throw new HttpError(503,'The email provider could not accept the message. Please try again later.');return (await r.json()).id as string;
}
