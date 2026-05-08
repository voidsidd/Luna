import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

export async function getCurrentUserId() {
  if (!isSupabaseConfigured || !supabase) return undefined;
  const { data, error } = await supabase.auth.getUser();
  if (error) return undefined;
  return data.user?.id;
}
