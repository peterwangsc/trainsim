import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;
export let supabase: SupabaseClient;

export function initSupabase(): SupabaseClient {
  if (supabase) return supabase;
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  return supabase;
}
