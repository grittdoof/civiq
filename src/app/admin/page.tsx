import { redirect } from "next/navigation";

// /admin → /admin/dashboard (alias propre depuis la home)
export default function AdminIndex() {
  redirect("/admin/dashboard");
}
