"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Filter, Shield, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AuditLogItemDto, AuditLogListDto } from "@/lib/audit/model";

interface AuditViewProps {
  initialData: AuditLogListDto;
}

export function AuditView({ initialData }: AuditViewProps) {
  const router = useRouter();
  const { items, total, page, totalPages } = initialData;

  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedItem, setSelectedItem] = useState<AuditLogItemDto | null>(
    null,
  );

  function applyFilters(newPage = 1) {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (entityType) params.set("entityType", entityType);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (newPage > 1) params.set("page", String(newPage));
    router.push(`/audit?${params.toString()}`);
  }

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    applyFilters(1);
  }

  function clearFilters() {
    setAction("");
    setEntityType("");
    setFrom("");
    setTo("");
    router.push("/audit");
  }

  const actionBadgeColor: Record<string, string> = {
    CREATE_USER:
      "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    UPDATE_USER:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    DISABLE_USER: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    ENABLE_USER:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    CHANGE_ROLE:
      "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    RESET_PASSWORD:
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    CHANGE_OWN_PASSWORD:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
    LOGIN:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    CREATE_TASK:
      "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    UPDATE_TASK:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    REASSIGN_TASK:
      "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    CANCEL_TASK: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    DELETE_TASK: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    MARK_TASK_COMPLETED:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    MARK_TASK_NOT_COMPLETED:
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    CORRECT_TASK_PROGRESS:
      "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    ADD_TASK_ASSET:
      "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
    REMOVE_TASK_ASSET:
      "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  };

  return (
    <div className="space-y-6">
      {/* Filter Form */}
      <Card className="p-4">
        <form onSubmit={handleFilterSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="audit-action"
                className="text-xs text-muted-foreground"
              >
                Hành động (Action)
              </Label>
              <Input
                id="audit-action"
                placeholder="vd: CREATE_TASK, LOGIN..."
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="audit-entity"
                className="text-xs text-muted-foreground"
              >
                Loại đối tượng (Entity Type)
              </Label>
              <Input
                id="audit-entity"
                placeholder="vd: task, user..."
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="audit-from"
                className="text-xs text-muted-foreground"
              >
                Từ ngày
              </Label>
              <Input
                id="audit-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="audit-to"
                className="text-xs text-muted-foreground"
              >
                Đến ngày
              </Label>
              <Input
                id="audit-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-xs text-muted-foreground"
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Xóa bộ lọc
            </Button>
            <Button type="submit" size="sm" className="h-8 text-xs">
              <Filter className="mr-1.5 h-3.5 w-3.5" />
              Lọc nhật ký
            </Button>
          </div>
        </form>
      </Card>

      {/* Audit Log Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Tổng số {total} bản ghi nhật ký</span>
          {totalPages > 1 && (
            <span>
              Trang {page} / {totalPages}
            </span>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Người thực hiện</th>
                <th className="px-4 py-3">Hành động</th>
                <th className="px-4 py-3">Đối tượng</th>
                <th className="px-4 py-3 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Không tìm thấy bản ghi nhật ký nào.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {item.actorName}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          actionBadgeColor[item.action] ||
                          "bg-muted text-foreground"
                        }`}
                      >
                        {item.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      <span className="font-medium text-foreground">
                        {item.entityType}
                      </span>
                      {item.entityId && ` (${item.entityId.slice(0, 8)}...)`}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setSelectedItem(item)}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        Xem
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => applyFilters(page - 1)}
            >
              Trang trước
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => applyFilters(page + 1)}
            >
              Trang sau
            </Button>
          </div>
        )}
      </div>

      {/* Snapshot Dialog */}
      <Dialog
        open={selectedItem !== null}
        onOpenChange={(open) => !open && setSelectedItem(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Chi tiết nhật ký: {selectedItem?.action}
            </DialogTitle>
            <DialogDescription>
              ID: {selectedItem?.id} · {selectedItem?.createdAt}
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-3">
                <div>
                  <span className="text-muted-foreground">
                    Người thực hiện:
                  </span>{" "}
                  <strong>{selectedItem.actorName}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Đối tượng:</span>{" "}
                  <strong>
                    {selectedItem.entityType} ({selectedItem.entityId || "N/A"})
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">IP:</span>{" "}
                  <span>{selectedItem.ipAddress || "N/A"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">User Agent:</span>{" "}
                  <span className="truncate block">
                    {selectedItem.userAgent || "N/A"}
                  </span>
                </div>
              </div>

              {selectedItem.beforeData && (
                <div className="space-y-1">
                  <span className="font-semibold text-muted-foreground">
                    Dữ liệu trước (Before):
                  </span>
                  <pre className="rounded-md bg-muted p-3 overflow-x-auto text-[11px]">
                    {JSON.stringify(selectedItem.beforeData, null, 2)}
                  </pre>
                </div>
              )}

              {selectedItem.afterData && (
                <div className="space-y-1">
                  <span className="font-semibold text-muted-foreground">
                    Dữ liệu sau (After):
                  </span>
                  <pre className="rounded-md bg-muted p-3 overflow-x-auto text-[11px]">
                    {JSON.stringify(selectedItem.afterData, null, 2)}
                  </pre>
                </div>
              )}

              {selectedItem.metadata && (
                <div className="space-y-1">
                  <span className="font-semibold text-muted-foreground">
                    Metadata:
                  </span>
                  <pre className="rounded-md bg-muted p-3 overflow-x-auto text-[11px]">
                    {JSON.stringify(selectedItem.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
