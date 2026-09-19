import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";

export default async function HomePage() {
  const actor = await getCurrentSession();
  if (!actor) {
    redirect("/login");
  }
  redirect("/dashboard");
}
