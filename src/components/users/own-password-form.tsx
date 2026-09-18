"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function OwnPasswordForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    try {
      const result = await fetch("/api/users/own-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      form.reset();
      if (!result.ok) {
        setError(
          "Password change failed. Check your current password and use 12–128 characters for the new one.",
        );
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Unable to change password. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      aria-label="Change own password"
      onSubmit={submit}
      className="max-w-md space-y-5"
    >
      <div className="space-y-2">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Use 12–128 characters. All sessions will end after a successful change.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <Button className="min-h-11" disabled={busy}>
        {busy ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
