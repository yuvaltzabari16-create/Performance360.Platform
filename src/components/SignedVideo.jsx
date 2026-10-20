import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function SignedVideo({ fileUri, className }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    if (!fileUri) return;
    base44.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri })
      .then((r) => { if (active) setUrl(r.signed_url); })
      .catch(() => {});
    return () => { active = false; };
  }, [fileUri]);
  if (!url) return <div className="aspect-video bg-muted rounded-lg animate-pulse" />;
  return <video src={url} controls className={className} />;
}