import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Auth disabled for development
    setLoading(false);
  }, []);

  return { user, loading };
}
