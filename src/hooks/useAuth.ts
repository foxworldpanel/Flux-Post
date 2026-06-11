import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>({ id: 'dev-user' } as User);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Auth disabled for testing
    setLoading(false);
  }, []);

  return { user, loading };
}
