import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { getUserAndRole } from "@/lib/role";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getUserAndRole();
  if (!auth) redirect("/login");
  if (auth.role === "none") redirect("/unauthorized");
  return (
    <Shell role={auth.role} email={auth.email}>
      {children}
    </Shell>
  );
}
