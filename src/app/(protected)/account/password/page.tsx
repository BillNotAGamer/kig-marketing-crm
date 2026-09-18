import { requireRole } from "@/lib/auth/session";
import { OwnPasswordForm } from "@/components/users/own-password-form";

export default async function OwnPasswordPage() {
  await requireRole("HEAD");
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold">Change own password</h1>
      <OwnPasswordForm />
    </section>
  );
}
