import Link from "next/link";
import { requireSession } from "@/lib/auth/session";

export default async function AccessDenied() {
  await requireSession();
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">403 · Access denied</p>
      <h1 className="text-2xl font-semibold">
        You do not have permission to open this page.
      </h1>
      <Link href="/app" className="underline">
        Return home
      </Link>
    </section>
  );
}
