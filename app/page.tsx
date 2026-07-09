import { redirect } from "next/navigation";
import { getUserAndRole } from "@/lib/role";

export default async function Home() {
  const auth = await getUserAndRole();
  if (!auth) redirect("/login");
  if (auth.role === "none") redirect("/unauthorized");
  redirect("/today");
}
