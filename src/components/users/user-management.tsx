"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { userSummary } from "@/lib/users/service";

type Summary = ReturnType<typeof userSummary>;
const selectClass =
  "min-h-11 w-full rounded-md border bg-background px-3 text-sm";
export function UserManagement({
  users,
  actorId,
}: {
  users: Summary[];
  actorId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function send(
    url: string,
    body: Record<string, unknown>,
    form?: HTMLFormElement,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await result.json();
      if (!result.ok) {
        setError(data.error || "Operation failed.");
        return;
      }
      if (form?.dataset.clear === "true") form.reset();
      setMessage("User saved.");
      router.refresh();
    } catch {
      setError("Unable to save. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  function submit(
    event: FormEvent<HTMLFormElement>,
    url: string,
    operation?: string,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const body: Record<string, unknown> = Object.fromEntries(
      new FormData(form),
    );
    if (operation) body.operation = operation;
    void send(url, body, form);
  }
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create user</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            aria-label="Create user"
            data-clear="true"
            onSubmit={(e) => submit(e, "/api/users")}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field id="create-name" label="Name" name="name" />
            <Field id="create-email" label="Email" name="email" type="email" />
            <div className="space-y-2">
              <Label htmlFor="create-role">Role</Label>
              <select id="create-role" name="role" className={selectClass}>
                <option>EMPLOYEE</option>
                <option>DEPUTY</option>
              </select>
            </div>
            <Field
              id="create-password"
              label="Initial password"
              name="password"
              type="password"
            />
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Passwords: 12–128 characters. Use a strong, unique passphrase.
            </p>
            <Button className="min-h-11" disabled={busy}>
              Create user
            </Button>
          </form>
        </CardContent>
      </Card>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {users.map((value) => (
          <Card key={value.id} aria-label={`User ${value.email}`}>
            <CardHeader>
              <CardTitle>{value.name}</CardTitle>
              <p className="break-all text-sm text-muted-foreground">
                {value.email}
              </p>
              <p className="text-sm">
                {value.role} · {value.banned ? "INACTIVE" : "ACTIVE"}
              </p>
              <p className="text-xs text-muted-foreground">
                Created{" "}
                {new Intl.DateTimeFormat("en-GB", {
                  dateStyle: "medium",
                  timeZone: "Asia/Ho_Chi_Minh",
                }).format(new Date(value.createdAt))}
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <form
                aria-label={`Edit ${value.email}`}
                onSubmit={(e) => submit(e, `/api/users/${value.id}`, "update")}
                className="space-y-3"
              >
                <Field
                  id={`${value.id}-name`}
                  label="Name"
                  name="name"
                  defaultValue={value.name}
                />
                <Field
                  id={`${value.id}-email`}
                  label="Email"
                  name="email"
                  type="email"
                  defaultValue={value.email}
                />
                <Button variant="outline" className="min-h-11" disabled={busy}>
                  Save identity
                </Button>
              </form>
              <form
                aria-label={`Role ${value.email}`}
                onSubmit={(e) =>
                  submit(e, `/api/users/${value.id}`, "change-role")
                }
                className="space-y-3"
              >
                <Label htmlFor={`${value.id}-role`}>Role</Label>
                <select
                  id={`${value.id}-role`}
                  name="role"
                  defaultValue={value.role}
                  className={selectClass}
                >
                  <option>HEAD</option>
                  <option>DEPUTY</option>
                  <option>EMPLOYEE</option>
                </select>
                <Button variant="outline" className="min-h-11" disabled={busy}>
                  Change role
                </Button>
              </form>
              <Button
                variant={value.banned ? "outline" : "destructive"}
                className="min-h-11"
                disabled={busy}
                onClick={() =>
                  void send(`/api/users/${value.id}`, {
                    operation: value.banned ? "enable" : "disable",
                  })
                }
              >
                {value.banned ? "Enable user" : "Disable user"}
              </Button>
              {value.id !== actorId && (
                <form
                  aria-label={`Password ${value.email}`}
                  data-clear="true"
                  onSubmit={(e) =>
                    submit(e, `/api/users/${value.id}`, "reset-password")
                  }
                  className="space-y-3"
                >
                  <Field
                    id={`${value.id}-password`}
                    label="New password"
                    name="password"
                    type="password"
                  />
                  <Button
                    variant="outline"
                    className="min-h-11"
                    disabled={busy}
                  >
                    Reset password
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
function Field({
  id,
  label,
  name,
  type = "text",
  defaultValue,
}: {
  id: string;
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required
        minLength={type === "password" ? 12 : 1}
        maxLength={type === "password" ? 128 : name === "name" ? 100 : 254}
        autoComplete={type === "password" ? "new-password" : "off"}
        className="min-h-11"
      />
    </div>
  );
}
