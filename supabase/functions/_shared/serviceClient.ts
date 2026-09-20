import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

/** 서비스 롤 클라이언트 (RLS 우회) */
export function getServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not configured');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
