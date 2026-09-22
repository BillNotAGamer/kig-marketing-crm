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
import {
  taskStatusDisplay,
  taskPriorityDisplay,
  formatDisplayDate,
} from "@/lib/ui-labels";

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
  const canReassign =
    (actor.role === "ADMIN" ||
      actor.role === "HEAD" ||
      actor.role === "DEPUTY") &&
    task.status === "OPEN";
  const canEdit =
    (actor.role === "ADMIN" || actor.role === "HEAD") && task.status === "OPEN";
  const canCancel =
    (actor.role === "ADMIN" || actor.role === "HEAD") && task.status === "OPEN";
  const canDelete = actor.role === "ADMIN" || actor.role === "HEAD";

  const options = canReassign
    ? await getTasks().listAssignees(new Headers(await headers()))
    : [];
  return (
    <>
      <Link href="/tasks" className="text-sm underline">
        Quay lại danh sách công việc
      </Link>
      <article className="space-y-6 rounded-xl border bg-card p-5 sm:p-8">
        <div>
          <p className="mb-3 text-sm">
            {taskStatusDisplay[task.status] ?? task.status} ·{" "}
            {taskPriorityDisplay[task.priority] ?? task.priority}
          </p>
          <h1 className="break-words text-3xl font-semibold">{task.title}</h1>
          {task.createdById === task.assignedToId && (
            <p className="mt-2 text-sm text-muted-foreground">
              Công việc tự tạo
            </p>
          )}
        </div>
        <p className="whitespace-pre-wrap break-words text-muted-foreground">
          {task.description || "Không có mô tả."}
        </p>
        <dl className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Thương hiệu"
            value={task.brandName ?? "Chưa chỉ định brand"}
          />
          <Field label="Người thực hiện" value={task.assignee.name} />
          <Field label="Người tạo" value={task.creator.name} />
          <Field
            label="Ngày giao việc"
            value={formatDisplayDate(task.assignedDate)}
          />
          <Field
            label="Hạn hoàn thành"
            value={
              task.dueDate ? formatDisplayDate(task.dueDate) : "Không có hạn"
            }
          />
        </dl>
        {task.cancelledAt && (
          <p className="text-sm text-muted-foreground">
            Đã hủy lúc{" "}
            {new Intl.DateTimeFormat("vi-VN", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Asia/Ho_Chi_Minh",
            }).format(new Date(task.cancelledAt))}
          </p>
        )}
      </article>
      <AssetSection taskId={task.id} view={assets} />
      <ProgressSection taskId={task.id} view={progress} />
      {(canEdit || canReassign || canCancel || canDelete) && (
        <TaskActions
          task={task}
          options={options}
          canEdit={canEdit}
          canReassign={canReassign}
          canCancel={canCancel}
          canDelete={canDelete}
        />
      )}
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
