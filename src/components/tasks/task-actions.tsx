"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { AssigneeOption, TaskDTO } from "@/lib/tasks/types";
import { roleDisplay } from "@/lib/ui-labels";

export function TaskActions({
  task,
  options,
  canEdit = true,
  canReassign = true,
  canCancel = true,
  canDelete = true,
}: {
  task: TaskDTO;
  options: AssigneeOption[];
  canEdit?: boolean;
  canReassign?: boolean;
  canCancel?: boolean;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<"cancel" | "soft-delete" | null>(null);

  const hasOpenActions =
    task.status === "OPEN" && (canEdit || canReassign || canCancel);

  if (!hasOpenActions && !canDelete) {
    return null;
  }

  async function send(command: string, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await fetch(`/api/tasks/${task.id}/${command}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await result.json();
      if (!result.ok) {
        setError(data.error || "Thao tác thất bại.");
        return;
      }
      setConfirm(null);
      setMessage("Đã lưu công việc.");
      if (command === "soft-delete") router.replace("/tasks");
      router.refresh();
    } catch {
      setError("Không thể lưu. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }
  function reassign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(
      "reassign",
      Object.fromEntries(new FormData(event.currentTarget)),
    );
  }
  return (
    <section
      aria-label="Quản trị công việc"
      className="space-y-5 rounded-xl border bg-card p-5"
    >
      <h2 className="text-lg font-semibold">Quản trị công việc</h2>
      {hasOpenActions && (
        <>
          {canEdit && (
            <Button variant="outline" asChild className="min-h-11">
              <Link href={`/tasks/${task.id}/edit`}>Chỉnh sửa công việc</Link>
            </Button>
          )}
          {canReassign && (
            <form
              aria-label="Chuyển giao công việc"
              onSubmit={reassign}
              className="max-w-md space-y-3"
            >
              <Label htmlFor="new-assignee">Người thực hiện mới</Label>
              <select
                id="new-assignee"
                name="assignedToId"
                required
                defaultValue=""
                className="min-h-11 w-full rounded-md border bg-background px-3 text-base sm:text-sm"
              >
                <option value="" disabled>
                  Chọn nhân viên đang hoạt động
                </option>
                {options
                  .filter((value) => value.id !== task.assignedToId)
                  .map((value) => (
                    <option key={value.id} value={value.id}>
                      {value.name} · {roleDisplay[value.role] ?? value.role}
                    </option>
                  ))}
              </select>
              <Button variant="outline" disabled={busy} className="min-h-11">
                Chuyển giao công việc
              </Button>
            </form>
          )}
          {canCancel && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirm("cancel")}
              className="min-h-11"
            >
              Hủy công việc
            </Button>
          )}
        </>
      )}
      {canDelete && (
        <div>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => setConfirm("soft-delete")}
            className="min-h-11"
          >
            Xóa công việc
          </Button>
        </div>
      )}
      {confirm && (
        <div
          role="group"
          aria-label="Xác nhận thao tác"
          className="space-y-3 rounded-lg border p-4"
        >
          <p className="text-sm">
            {confirm === "cancel"
              ? "Hủy yêu cầu công việc này? Công việc vẫn được lưu trong lịch sử."
              : "Xóa công việc này khỏi danh sách làm việc? Lịch sử công việc vẫn được lưu giữ."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={busy}
              onClick={() => void send(confirm, {})}
              className="min-h-11"
            >
              {confirm === "cancel" ? "Xác nhận hủy" : "Xác nhận xóa"}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirm(null)}
              className="min-h-11"
            >
              Giữ lại công việc
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
