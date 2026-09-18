"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  priorities,
  type AssigneeOption,
  type TaskDTO,
} from "@/lib/tasks/types";

export function TaskForm({
  options,
  employee,
  assignedDate,
  task,
}: {
  options: AssigneeOption[];
  employee: boolean;
  assignedDate: string;
  task?: TaskDTO;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const body = {
      ...values,
      description: values.description || null,
      dueDate: values.dueDate || null,
    };
    try {
      const result = await fetch(
        task ? `/api/tasks/${task.id}/metadata` : "/api/tasks",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await result.json();
      if (!result.ok) {
        setError(data.error || "Unable to save task.");
        return;
      }
      router.replace(`/tasks/${task?.id ?? data.id}`);
      router.refresh();
    } catch {
      setError("Unable to save task. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  const control =
    "min-h-11 w-full rounded-md border border-input bg-background px-3 text-base sm:text-sm";
  return (
    <form
      aria-label={task ? "Edit task" : "Create task"}
      onSubmit={submit}
      className="max-w-2xl space-y-5"
    >
      <div className="space-y-2">
        <Label htmlFor="task-title">Title</Label>
        <Input
          id="task-title"
          name="title"
          required
          maxLength={200}
          defaultValue={task?.title}
          className="min-h-11"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="task-description">Description</Label>
        <textarea
          id="task-description"
          name="description"
          maxLength={10_000}
          defaultValue={task?.description ?? ""}
          rows={4}
          className={`${control} py-3`}
        />
      </div>
      {!task && (
        <div className="space-y-2">
          <Label htmlFor="task-assignee">Assignee</Label>
          {employee ? (
            <>
              <p className="text-sm">You — {options[0]?.name}</p>
              <input
                type="hidden"
                name="assignedToId"
                value={options[0]?.id ?? ""}
              />
            </>
          ) : (
            <select
              id="task-assignee"
              name="assignedToId"
              required
              className={control}
              defaultValue=""
            >
              <option value="" disabled>
                Choose an active user
              </option>
              {options.map((value) => (
                <option key={value.id} value={value.id}>
                  {value.name} ({value.role})
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="assigned-date">Assigned date</Label>
          <Input
            id="assigned-date"
            name="assignedDate"
            type="date"
            required
            defaultValue={task?.assignedDate ?? assignedDate}
            className="min-h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="due-date">Due date (optional)</Label>
          <Input
            id="due-date"
            name="dueDate"
            type="date"
            defaultValue={task?.dueDate ?? ""}
            className="min-h-11"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="task-priority">Priority</Label>
        <select
          id="task-priority"
          name="priority"
          defaultValue={task?.priority ?? "NORMAL"}
          className={control}
        >
          {priorities.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>
      <p className="text-sm text-muted-foreground">
        Dates follow Asia/Ho_Chi_Minh.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button disabled={busy} className="min-h-11 w-full sm:w-auto">
        {busy ? "Saving…" : task ? "Save task" : "Create task"}
      </Button>
    </form>
  );
}
