import {sourceEvidence} from './source-evidence';

// Exact standalone failure messages, rather than a minimum length, leave short
// legitimate news and reporting about outages eligible.
const failureMessages = [
  'apps not working',
  'apps are not working',
  'app not working',
  'app is not working',
  'application error',
  'access denied',
  'service unavailable',
  'temporarily unavailable',
  'page not found',
  'enable javascript to continue',
  'please enable javascript',
  'checking your browser',
];
export function isFeedFailure(value: string | null | undefined) {
  const normalized = (value || '').trim().toLowerCase().replace(/[.!\s]+$/g, '');
  return failureMessages.includes(normalized) || /^error (?:403|404|429|500|502|503|504)$/.test(normalized);
}
// This fixed SQL expression mirrors isFeedFailure for the queue selector.
export const failureSql = (column: string) =>
  `(regexp_replace(lower(trim(coalesce(${column},''))), '[.![:space:]]+$', '') IN (${failureMessages.map(s => "'" + s + "'").join(',')}) OR regexp_replace(lower(trim(coalesce(${column},''))), '[.![:space:]]+$', '') ~ '^error (403|404|429|500|502|503|504)$')`;

export function failedEvidence(item: {title:string;kind:string;source_id:string;source_context?:string|null;excerpt?:string|null;fetched_at?:string|Date|null;document?:{evidence?:{revision?:string}}|null}) {
  const body = item.source_context?.trim() || item.excerpt?.trim() || '';
  const revision = item.document?.evidence?.revision;
  return !!revision && revision === sourceEvidence(item).revision && isFeedFailure(body);
}

export function cleanFailureText<T extends {excerpt?:string|null; summary?:string|null}>(item:T):T {
  return {...item,
    excerpt: isFeedFailure(item.excerpt) ? '' : item.excerpt,
    summary: isFeedFailure(item.summary) ? '' : item.summary,
  };
}
