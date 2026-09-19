import Link from "next/link";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { getTasks } from "@/lib/tasks/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TasksPage() {
  const actor = await requireSession();
  const tasks = await getTasks().listTasks(new Headers(await headers()));
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Tasks</h1>
          <p className="mt-2 text-muted-foreground">
            {actor.role === "EMPLOYEE"
              ? "Work currently assigned to you."
              : "Team work and task history."}
          </p>
        </div>
        <Button asChild className="min-h-11">
          <Link href="/tasks/new">Create task</Link>
        </Button>
      </div>
      {!tasks.length && (
        <p className="rounded-xl border bg-card p-6 text-muted-foreground">
          No tasks yet.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tasks.map((task) => (
          <Card key={task.id}>
            <CardHeader>
              <CardTitle>
                <Link
                  href={`/tasks/${task.id}`}
                  className="break-words underline-offset-4 hover:underline"
                >
                  {task.title}
                </Link>
              </CardTitle>
              <p className="text-sm">
                {task.status} · {task.priority}
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">
                <span className="text-xs text-muted-foreground">Brand: </span>
                <span className="font-medium">
                  {task.brandName ?? "Chưa chỉ định brand"}
                </span>
              </p>
              <p className="break-words text-sm">
                Assigned to {task.assignee.name}
              </p>
              <p className="text-sm text-muted-foreground">
                Assigned {task.assignedDate}
                {task.dueDate ? ` · Due ${task.dueDate}` : ""}
              </p>
              {task.createdById === task.assignedToId && (
                <p className="text-xs text-muted-foreground">Self-created</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
