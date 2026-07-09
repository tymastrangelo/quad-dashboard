import { redirect } from "next/navigation";
import { getUserAndRole } from "@/lib/role";
import { DisplayClient } from "./DisplayClient";

export default async function DisplayPage() {
  const auth = await getUserAndRole();
  if (!auth) redirect("/login");
  if (auth.role === "none") redirect("/unauthorized");
  return <DisplayClient />;
}
