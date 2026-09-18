import { requireSession } from "@/lib/auth/session";

export default async function ApplicationHome() {
  const actor = await requireSession();
  return (
    <section className="rounded-xl border bg-card p-6 sm:p-10">
      <p className="text-sm text-muted-foreground">Internal workspace</p>
      <h1 className="mt-2 text-3xl font-semibold">Welcome, {actor.name}</h1>
      <p className="mt-4 text-muted-foreground">
        Your account is ready. Marketing work tools will be introduced in later
        phases.
      </p>
    </section>
  );
}
