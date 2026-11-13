import {randomUUID,sign} from 'node:crypto';
import {ECOSYSTEM_ENDPOINT,ecosystemSources,ecosystemRequestMessage,verifyEcosystemDecision,ecosystemSubject} from '../shared/ecosystem-authority.mjs';
export {ecosystemSubject};
/** Server-only. Subjects must come from the site's validated session, never a browser-supplied list.
 * @param {string} project
 * @param {string[]} subjects
 * @param {{env?:Record<string,string|undefined>,fetcher?:typeof fetch,authenticatedWallet?:string|null,verifiedEmails?:{subject:string,email:string}[],reviewerCandidates?:string[],purpose?:'role-feed-enrollment'}} options
 */
export async function ecosystemAccess(project,subjects,{env=process.env,fetcher=fetch,authenticatedWallet=null,verifiedEmails=[],reviewerCandidates,purpose}={}){
 if(!ecosystemSources[project]||!env.ROLES_ECOSYSTEM_REQUEST_PRIVATE_KEY||!env.ROLES_ECOSYSTEM_DECISION_PUBLIC_KEY)throw Object.assign(Error('Shared Roles verification is unavailable'),{status:503});
 const request={version:1,project,source:ecosystemSources[project].host,audience:ECOSYSTEM_ENDPOINT,subjects:[...new Set(subjects)],authenticatedWallet,verifiedEmails,...(reviewerCandidates?{reviewerCandidates}:{}),...(purpose?{purpose}:{}),issuedAt:Date.now(),requestId:randomUUID()};
 const signature=sign(null,Buffer.from(ecosystemRequestMessage(request)),env.ROLES_ECOSYSTEM_REQUEST_PRIVATE_KEY).toString('base64');
 const response=await fetcher(ECOSYSTEM_ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({request,signature}),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Object.assign(Error('Shared Roles verification is unavailable'),{status:503});
 const decision=verifyEcosystemDecision(await response.json(),request,env.ROLES_ECOSYSTEM_DECISION_PUBLIC_KEY);
 if(purpose&&(decision.authoritative||decision.actions.length))throw Error('Invalid Roles enrollment response');
 return decision;
}
