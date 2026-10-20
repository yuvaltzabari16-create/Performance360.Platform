import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

export function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    base44.auth.me()
      .then((u) => { if (active) { setUser(u); setLoading(false); } })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return { user, loading, setUser };
}

export const todayStr = () => new Date().toISOString().slice(0, 10);