import { createClient } from "@/lib/supabase/server";

export type Role = "super" | "elon" | "none";

// Server-side role resolution. Both RPCs are SECURITY DEFINER and enforce the
// check in SQL — this is routing convenience, the database is the boundary.
export async function getUserAndRole(): Promise<{
  email: string | null;
  role: Role;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [superRes, elonRes] = await Promise.all([
    supabase.rpc("is_app_super_admin"),
    supabase.rpc("is_elon_admin"),
  ]);
  const role: Role = superRes.data ? "super" : elonRes.data ? "elon" : "none";
  return { email: user.email ?? null, role };
}
