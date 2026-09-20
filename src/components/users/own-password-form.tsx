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
          "Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu hiện tại và nhập mật khẩu mới từ 6–128 ký tự.",
        );
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Không thể đổi mật khẩu. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      aria-label="Đổi mật khẩu"
      onSubmit={submit}
      className="max-w-md space-y-5"
    >
      <div className="space-y-2">
        <Label htmlFor="current-password">Mật khẩu hiện tại</Label>
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
        <Label htmlFor="new-password">Mật khẩu mới</Label>
        <Input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={6}
          maxLength={128}
          required
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Mật khẩu gồm 6–128 ký tự. Tất cả các phiên đăng nhập sẽ kết thúc sau khi
        đổi mật khẩu thành công.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <Button className="min-h-11" disabled={busy}>
        {busy ? "Đang lưu…" : "Đổi mật khẩu"}
      </Button>
    </form>
  );
}
