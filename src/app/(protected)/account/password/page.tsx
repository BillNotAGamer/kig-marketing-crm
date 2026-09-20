import { requireSession } from "@/lib/auth/session";
import { OwnPasswordForm } from "@/components/users/own-password-form";

export default async function OwnPasswordPage() {
  await requireSession();
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold">Đổi mật khẩu</h1>
      <OwnPasswordForm />
    </section>
  );
}
