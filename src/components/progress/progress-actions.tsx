"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ProgressDTO } from "@/lib/progress/model";

export function ProgressActions({
  taskId,
  latest,
  correction = false,
}: {
  taskId: string;
  latest?: ProgressDTO;
  correction?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"COMPLETED" | "NOT_COMPLETED">(
    correction && latest?.status === "COMPLETED"
      ? "NOT_COMPLETED"
      : "COMPLETED",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/tasks/${taskId}/progress${correction ? `/${latest?.id}/correct` : ""}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            ...(status === "NOT_COMPLETED"
              ? { reason: form.get("reason") }
              : {}),
            ...(correction
              ? { correctionReason: form.get("correctionReason") }
              : {}),
          }),
        },
      );
      if (!response.ok) {
        const body: { error?: string } = await response.json();
        setError(body.error ?? "Unable to save report.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Unable to save report. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) {
          setOpen(value);
          setError("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant={correction ? "outline" : "default"}
          className="min-h-11"
        >
          {correction ? "Sửa báo cáo hành chính" : "Báo cáo tiến độ"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {correction ? "Sửa báo cáo hành chính" : "Daily Progress"}
          </DialogTitle>
          <DialogDescription>
            {correction
              ? "HEAD correction changes the latest report and Task lifecycle. An administrative reason is required."
              : "One official report per task and business date (Asia/Ho_Chi_Minh). Reports cannot be edited after submission."}
          </DialogDescription>
        </DialogHeader>
        <form
          aria-label={correction ? "Correct progress" : "Submit progress"}
          onSubmit={submit}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label
              htmlFor={correction ? "correction-status" : "progress-status"}
            >
              Report status
            </Label>
            <select
              id={correction ? "correction-status" : "progress-status"}
              value={status}
              disabled={busy}
              onChange={(event) =>
                setStatus(event.target.value as typeof status)
              }
              className="min-h-11 w-full rounded-md border bg-background px-3"
            >
              {(!correction || latest?.status !== "COMPLETED") && (
                <option value="COMPLETED">Hoàn thành</option>
              )}
              {(!correction || latest?.status !== "NOT_COMPLETED") && (
                <option value="NOT_COMPLETED">Chưa hoàn thành</option>
              )}
            </select>
          </div>
          {status === "NOT_COMPLETED" && (
            <div className="space-y-2">
              <Label htmlFor="incomplete-reason">Incomplete reason</Label>
              <textarea
                id="incomplete-reason"
                name="reason"
                required
                maxLength={5000}
                disabled={busy}
                className="min-h-28 w-full rounded-md border bg-background p-3"
              />
            </div>
          )}
          {correction && (
            <div className="space-y-2">
              <Label htmlFor="correction-reason">Correction reason</Label>
              <textarea
                id="correction-reason"
                name="correctionReason"
                required
                maxLength={5000}
                disabled={busy}
                className="min-h-24 w-full rounded-md border bg-background p-3"
              />
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy} className="min-h-11 w-full">
            {busy ? "Saving…" : correction ? "Save correction" : "Gửi báo cáo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
