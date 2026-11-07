import { redirect } from "next/navigation";

// /admin → page d'arrivée selon le profil (lot 3)
export default function AdminIndex() {
  redirect("/admin/accueil");
}
