import { requireSession } from "@/lib/auth/session";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function ApplicationHome() {
  const actor = await requireSession();
  return (
    <section className="rounded-xl border bg-card p-6 sm:p-10">
      <p className="text-sm text-muted-foreground">Internal workspace</p>
      <h1 className="mt-2 text-3xl font-semibold">Welcome, {actor.name}</h1>
      <p className="mt-4 text-muted-foreground">
        Open your tasks to plan and manage current work.
      </p>
      <Button asChild className="mt-5 min-h-11">
        <Link href="/tasks">Open tasks</Link>
      </Button>
    </section>
  );
}
