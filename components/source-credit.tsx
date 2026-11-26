import {sourceLicense} from '@/lib/catalog';

type Props = {sourceId?: string; authors?: string[]};

export function SourceCredit({sourceId, authors}: Props) {
  const license = sourceLicense(sourceId);
  if (!sourceId || !license) return null;
  return <small className="muted">
    {authors?.length ? authors.join(', ') + ' · ' : ''}
    <a href={license.url} rel="license">{license.name}</a>{' · TBN excerpt or adaptation'}
  </small>;
}
