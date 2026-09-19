"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

interface LogoutButtonProps {
  className?: string;
  variant?:
    "outline" | "ghost" | "default" | "destructive" | "secondary" | "link";
  showIcon?: boolean;
}

export function LogoutButton({
  className,
  variant = "outline",
  showIcon = true,
}: LogoutButtonProps = {}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setBusy(true);
    setError("");
    try {
      const result = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!result.ok) throw new Error();
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Đăng xuất thất bại. Vui lòng thử lại.");
      setBusy(false);
    }
  }

  return (
    <div className={cn("w-full", className)}>
      <Button
        variant={variant}
        className="min-h-11 w-full justify-start gap-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        disabled={busy}
        onClick={logout}
        aria-label="Đăng xuất"
      >
        {showIcon && <LogOut className="h-4 w-4 shrink-0" />}
        <span>{busy ? "Đang đăng xuất…" : "Đăng xuất"}</span>
      </Button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
