import { createClient } from '@supabase/supabase-js';

const supabaseUrl = typeof window !== 'undefined' ? (window as any).env?.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '' : import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = typeof window !== 'undefined' ? (window as any).env?.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '' : import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing. Client might not work as expected.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
