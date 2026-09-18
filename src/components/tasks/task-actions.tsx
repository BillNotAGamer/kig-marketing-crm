"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { AssigneeOption, TaskDTO } from "@/lib/tasks/types";

export function TaskActions({
  task,
  options,
}: {
  task: TaskDTO;
  options: AssigneeOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<"cancel" | "soft-delete" | null>(null);
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
        setError(data.error || "Operation failed.");
        return;
      }
      setConfirm(null);
      setMessage("Task saved.");
      if (command === "soft-delete") router.replace("/tasks");
      router.refresh();
    } catch {
      setError("Unable to save. Please retry.");
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
      aria-label="Task administration"
      className="space-y-5 rounded-xl border bg-card p-5"
    >
      <h2 className="text-lg font-semibold">Manage task</h2>
      {task.status === "OPEN" && (
        <>
          <Button variant="outline" asChild className="min-h-11">
            <Link href={`/tasks/${task.id}/edit`}>Edit task</Link>
          </Button>
          <form
            aria-label="Reassign task"
            onSubmit={reassign}
            className="max-w-md space-y-3"
          >
            <Label htmlFor="new-assignee">New assignee</Label>
            <select
              id="new-assignee"
              name="assignedToId"
              required
              defaultValue=""
              className="min-h-11 w-full rounded-md border bg-background px-3 text-base sm:text-sm"
            >
              <option value="" disabled>
                Choose an active user
              </option>
              {options
                .filter((value) => value.id !== task.assignedToId)
                .map((value) => (
                  <option key={value.id} value={value.id}>
                    {value.name} ({value.role})
                  </option>
                ))}
            </select>
            <Button variant="outline" disabled={busy} className="min-h-11">
              Reassign task
            </Button>
          </form>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setConfirm("cancel")}
            className="min-h-11"
          >
            Cancel task
          </Button>
        </>
      )}
      <div>
        <Button
          variant="destructive"
          disabled={busy}
          onClick={() => setConfirm("soft-delete")}
          className="min-h-11"
        >
          Delete task
        </Button>
      </div>
      {confirm && (
        <div
          role="group"
          aria-label="Confirm task action"
          className="space-y-3 rounded-lg border p-4"
        >
          <p className="text-sm">
            {confirm === "cancel"
              ? "Cancel this requirement? The task stays in history."
              : "Remove this task from working views? Its history will be retained."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={busy}
              onClick={() => void send(confirm, {})}
              className="min-h-11"
            >
              {confirm === "cancel"
                ? "Confirm cancellation"
                : "Confirm deletion"}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirm(null)}
              className="min-h-11"
            >
              Keep task
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
