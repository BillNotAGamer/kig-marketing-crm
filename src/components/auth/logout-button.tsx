"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
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
      setError("Sign-out failed. Try again.");
      setBusy(false);
    }
  }
  return (
    <div>
      <Button
        variant="outline"
        className="min-h-11"
        disabled={busy}
        onClick={logout}
      >
        {busy ? "Signing out…" : "Sign out"}
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
