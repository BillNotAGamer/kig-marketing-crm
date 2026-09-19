import Link from "next/link";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { readTaskPage } from "@/lib/tasks/page";
import { getTasks } from "@/lib/tasks/server";
import { TaskActions } from "@/components/tasks/task-actions";
import { ProgressSection } from "@/components/progress/progress-section";
import { getProgress } from "@/lib/progress/server";
import { AssetSection } from "@/components/assets/asset-section";
import { getAssets } from "@/lib/assets/server";

export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireSession();
  const task = await readTaskPage((await params).id);
  const progress = await getProgress().getTaskProgress(
    new Headers(await headers()),
    task.id,
  );
  const assets = await getAssets().getTaskAssets(
    new Headers(await headers()),
    task.id,
  );
  const options =
    actor.role === "HEAD" && task.status === "OPEN"
      ? await getTasks().listAssignees(new Headers(await headers()))
      : [];
  return (
    <>
      <Link href="/tasks" className="text-sm underline">
        Back to tasks
      </Link>
      <article className="space-y-6 rounded-xl border bg-card p-5 sm:p-8">
        <div>
          <p className="mb-3 text-sm">
            {task.status} · {task.priority}
          </p>
          <h1 className="break-words text-3xl font-semibold">{task.title}</h1>
          {task.createdById === task.assignedToId && (
            <p className="mt-2 text-sm text-muted-foreground">
              Self-created task
            </p>
          )}
        </div>
        <p className="whitespace-pre-wrap break-words text-muted-foreground">
          {task.description || "No description."}
        </p>
        <dl className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Brand"
            value={task.brandName ?? "Chưa chỉ định brand"}
          />
          <Field label="Assignee" value={task.assignee.name} />
          <Field label="Creator" value={task.creator.name} />
          <Field label="Assigned date" value={task.assignedDate} />
          <Field label="Due date" value={task.dueDate ?? "No due date"} />
        </dl>
        {task.cancelledAt && (
          <p className="text-sm text-muted-foreground">
            Cancelled{" "}
            {new Intl.DateTimeFormat("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Asia/Ho_Chi_Minh",
            }).format(new Date(task.cancelledAt))}
          </p>
        )}
      </article>
      <AssetSection taskId={task.id} view={assets} />
      <ProgressSection taskId={task.id} view={progress} />
      {actor.role === "HEAD" && <TaskActions task={task} options={options} />}
    </>
  );
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-medium">{value}</dd>
    </div>
  );
}
