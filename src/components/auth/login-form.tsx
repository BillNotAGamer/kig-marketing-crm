"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema } from "@/lib/auth/validation";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const parsed = loginSchema.safeParse({
      email: data.get("email"),
      password: data.get("password"),
    });
    if (!parsed.success) {
      setError("Nhập email và mật khẩu hợp lệ.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        setError(
          "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin hoặc liên hệ với Admin.",
        );
        form.querySelector<HTMLInputElement>('input[name="password"]')!.value =
          "";
        return;
      }
      form.reset();
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Không thể đăng nhập. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5" aria-label="Đăng nhập">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
          className="min-h-11"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Mật khẩu</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
          className="min-h-11"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button className="min-h-11 w-full" disabled={loading}>
        {loading ? "Đang đăng nhập…" : "Đăng nhập"}
      </Button>
      <p className="text-sm text-muted-foreground">
        Tài khoản và mật khẩu được quản lý bởi Trưởng bộ phận.
      </p>
    </form>
  );
}
