"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { userSummary } from "@/lib/users/service";
import type { AppRole } from "@/lib/auth/roles";
import {
  allowedCreationRoles,
  canEditIdentity,
  canAssignRole,
  canDisableUser,
  canEnableUser,
  canResetPassword,
  canPermanentlyDeleteUser,
} from "@/lib/users/policy";
import { roleDisplay, formatDisplayDate } from "@/lib/ui-labels";

type Summary = ReturnType<typeof userSummary>;
const selectClass =
  "min-h-11 w-full rounded-md border bg-background px-3 text-sm";

export function UserManagement({
  users,
  actorId,
  actorRole = "HEAD",
}: {
  users: Summary[];
  actorId: string;
  actorRole?: AppRole;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deletingUser, setDeletingUser] = useState<Summary | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const actor = { id: actorId, role: actorRole, name: "", email: "" };
  const creationRoles = allowedCreationRoles(actorRole);

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
        setError(data.error || "Thao tác thất bại.");
        return;
      }
      if (form?.dataset.clear === "true") form.reset();
      setMessage("Đã lưu thông tin người dùng.");
      router.refresh();
    } catch {
      setError("Không thể lưu. Vui lòng thử lại.");
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

  async function handlePermanentDelete() {
    if (!deletingUser) return;
    setBusy(true);
    setDeleteError("");
    try {
      const result = await fetch(`/api/users/${deletingUser.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "delete-user",
          confirmationEmail: confirmEmail,
        }),
      });
      const data = await result.json();
      if (!result.ok) {
        setDeleteError(data.error || "Không thể xóa người dùng.");
        return;
      }
      if (deletingUser.id === actorId) {
        router.push("/login");
        return;
      }
      setMessage("Đã xóa vĩnh viễn tài khoản người dùng.");
      setDeletingUser(null);
      setConfirmEmail("");
      router.refresh();
    } catch {
      setDeleteError("Không thể thực hiện yêu cầu. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {creationRoles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tạo người dùng</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              aria-label="Tạo người dùng"
              data-clear="true"
              onSubmit={(e) => submit(e, "/api/users")}
              className="grid gap-4 sm:grid-cols-2"
            >
              <Field id="create-name" label="Họ và tên" name="name" />
              <Field
                id="create-email"
                label="Email"
                name="email"
                type="email"
              />
              <div className="space-y-2">
                <Label htmlFor="create-role">Vai trò</Label>
                <select id="create-role" name="role" className={selectClass}>
                  {creationRoles.map((role) => (
                    <option key={role} value={role}>
                      {roleDisplay[role] ?? role}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                id="create-password"
                label="Mật khẩu ban đầu"
                name="password"
                type="password"
              />
              <p className="text-sm text-muted-foreground sm:col-span-2">
                Mật khẩu gồm 6–128 ký tự. Hãy sử dụng mật khẩu mạnh và riêng
                biệt.
              </p>
              <Button className="min-h-11" disabled={busy}>
                Tạo người dùng
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {users.map((value) => {
          const target = { id: value.id, role: value.role };
          const assignableRoles = (
            ["ADMIN", "HEAD", "DEPUTY", "EMPLOYEE"] as AppRole[]
          ).filter((r) => canAssignRole(actor, target, r));

          const canToggleStatus = value.banned
            ? canEnableUser(actor, target)
            : canDisableUser(actor, target);

          return (
            <Card key={value.id} aria-label={`Người dùng ${value.email}`}>
              <CardHeader>
                <CardTitle>{value.name}</CardTitle>
                <p className="break-all text-sm text-muted-foreground">
                  {value.email}
                </p>
                <p className="text-sm">
                  {roleDisplay[value.role] ?? value.role} ·{" "}
                  {value.banned ? "Ngừng hoạt động" : "Đang hoạt động"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Ngày tạo: {formatDisplayDate(value.createdAt)}
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                {canEditIdentity(actor, target) && (
                  <form
                    aria-label={`Chỉnh sửa ${value.email}`}
                    onSubmit={(e) =>
                      submit(e, `/api/users/${value.id}`, "update")
                    }
                    className="space-y-3"
                  >
                    <Field
                      id={`${value.id}-name`}
                      label="Họ và tên"
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
                    <Button
                      variant="outline"
                      className="min-h-11"
                      disabled={busy}
                    >
                      Lưu thông tin
                    </Button>
                  </form>
                )}
                {assignableRoles.length > 0 && (
                  <form
                    aria-label={`Vai trò ${value.email}`}
                    onSubmit={(e) =>
                      submit(e, `/api/users/${value.id}`, "change-role")
                    }
                    className="space-y-3"
                  >
                    <Label htmlFor={`${value.id}-role`}>Vai trò</Label>
                    <select
                      id={`${value.id}-role`}
                      name="role"
                      defaultValue={value.role}
                      className={selectClass}
                    >
                      {assignableRoles.map((r) => (
                        <option key={r} value={r}>
                          {roleDisplay[r] ?? r}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      className="min-h-11"
                      disabled={busy}
                    >
                      Thay đổi vai trò
                    </Button>
                  </form>
                )}
                {canToggleStatus && (
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
                    {value.banned
                      ? "Kích hoạt người dùng"
                      : "Vô hiệu hóa người dùng"}
                  </Button>
                )}
                {canResetPassword(actor, target) && (
                  <form
                    aria-label={`Mật khẩu ${value.email}`}
                    data-clear="true"
                    onSubmit={(e) =>
                      submit(e, `/api/users/${value.id}`, "reset-password")
                    }
                    className="space-y-3"
                  >
                    <Field
                      id={`${value.id}-password`}
                      label="Mật khẩu mới"
                      name="password"
                      type="password"
                    />
                    <Button
                      variant="outline"
                      className="min-h-11"
                      disabled={busy}
                    >
                      Đặt lại mật khẩu
                    </Button>
                  </form>
                )}
                {canPermanentlyDeleteUser(actor, target) && (
                  <div className="border-t pt-2">
                    <Button
                      variant="destructive"
                      className="min-h-11"
                      disabled={busy}
                      onClick={() => {
                        setDeletingUser(value);
                        setConfirmEmail("");
                        setDeleteError("");
                      }}
                    >
                      Xóa vĩnh viễn
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={Boolean(deletingUser)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingUser(null);
            setConfirmEmail("");
            setDeleteError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa vĩnh viễn tài khoản</DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <span className="block font-medium text-destructive">
                Thao tác này sẽ xóa vĩnh viễn tài khoản người dùng và thông tin
                đăng nhập khỏi hệ thống. Thao tác này KHÔNG THỂ HOÀN TÁC.
              </span>
              {deletingUser && deletingUser.id === actorId && (
                <span className="block rounded-md border border-destructive/40 bg-destructive/10 p-2 font-medium text-destructive">
                  CẢNH BÁO: Bạn đang xóa chính tài khoản Quản trị viên của mình.
                  Sau khi xóa, phiên làm việc hiện tại sẽ kết thúc ngay lập tức.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {deletingUser && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="confirm-delete-email">
                  Nhập chính xác email <strong>{deletingUser.email}</strong> để
                  xác nhận:
                </Label>
                <Input
                  id="confirm-delete-email"
                  type="email"
                  autoComplete="off"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder={deletingUser.email}
                  disabled={busy}
                />
              </div>

              {deleteError && (
                <div
                  role="alert"
                  className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  <p>{deleteError}</p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/tasks">Xem công việc</Link>
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setDeletingUser(null);
                setConfirmEmail("");
                setDeleteError("");
              }}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              disabled={
                busy || !deletingUser || confirmEmail !== deletingUser.email
              }
              onClick={() => void handlePermanentDelete()}
            >
              Xóa vĩnh viễn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
        minLength={type === "password" ? 6 : 1}
        maxLength={type === "password" ? 128 : name === "name" ? 100 : 254}
        autoComplete={type === "password" ? "new-password" : "off"}
        className="min-h-11"
      />
    </div>
  );
}
