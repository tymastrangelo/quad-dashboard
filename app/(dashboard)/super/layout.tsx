import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Re-verify super admin server-side on every /super route. The RPCs enforce
// this again in SQL; this just keeps non-super admins out of the UI.
export default async function SuperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: isSuper } = await supabase.rpc("is_app_super_admin");
  if (!isSuper) redirect("/insights");
  return <>{children}</>;
}
