"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  CheckCircle,
  FileEdit,
  UserCheck,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { NotificationsListDto } from "@/lib/notifications/model";

interface NotificationsViewProps {
  initialData: NotificationsListDto;
}

export function NotificationsView({ initialData }: NotificationsViewProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set());

  const eventIcon: Record<string, React.ReactNode> = {
    TASK_ASSIGNED: <UserCheck className="h-4 w-4 text-emerald-600" />,
    TASK_UPDATED: <FileEdit className="h-4 w-4 text-blue-600" />,
    TASK_REASSIGNED: <UserCheck className="h-4 w-4 text-orange-600" />,
    TASK_CANCELLED: <XCircle className="h-4 w-4 text-destructive" />,
  };

  const eventLabel: Record<string, string> = {
    TASK_ASSIGNED: "Giao việc mới",
    TASK_UPDATED: "Cập nhật công việc",
    TASK_REASSIGNED: "Giao lại công việc",
    TASK_CANCELLED: "Hủy công việc",
  };

  async function handleMarkOneRead(id: string) {
    if (markingIds.has(id)) return;
    setMarkingIds((prev) => new Set(prev).add(id));

    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        setData((prev) => ({
          ...prev,
          unreadCount: Math.max(0, prev.unreadCount - 1),
          items: prev.items.map((item) =>
            item.id === id
              ? { ...item, readAt: new Date().toISOString() }
              : item,
          ),
        }));
        router.refresh();
      }
    } catch {
      // Ignored on failure
    } finally {
      setMarkingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleMarkAllRead() {
    if (isMarkingAll || data.unreadCount === 0) return;
    setIsMarkingAll(true);

    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        setData((prev) => ({
          ...prev,
          unreadCount: 0,
          items: prev.items.map((item) => ({
            ...item,
            readAt: item.readAt || new Date().toISOString(),
          })),
        }));
        router.refresh();
      }
    } catch {
      // Ignored
    } finally {
      setIsMarkingAll(false);
    }
  }

  function handlePageChange(newPage: number) {
    router.push(`/notifications?page=${newPage}`);
  }

  return (
    <div className="space-y-6">
      {/* Header action */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {data.unreadCount > 0 ? (
            <span>
              Bạn có{" "}
              <strong className="font-semibold text-foreground">
                {data.unreadCount}
              </strong>{" "}
              thông báo chưa đọc
            </span>
          ) : (
            <span>Tất cả thông báo đã được đọc</span>
          )}
        </div>

        {data.unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={isMarkingAll}
            className="h-8 text-xs"
          >
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            Đánh dấu tất cả đã đọc
          </Button>
        )}
      </div>

      {/* Notifications list */}
      {data.items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Bell className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
          <p className="text-base font-medium">Hộp thông báo trống</p>
          <p className="text-xs mt-1">Bạn chưa nhận được thông báo nào.</p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {data.items.map((item) => {
            const isUnread = item.readAt === null;

            return (
              <Card
                key={item.id}
                className={`p-4 transition-colors ${
                  isUnread
                    ? "border-primary/40 bg-primary/5 dark:bg-primary/10"
                    : "hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="mt-0.5 rounded-full border bg-card p-1.5 shadow-sm shrink-0">
                      {eventIcon[item.type] || <Bell className="h-4 w-4" />}
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          {eventLabel[item.type] || item.type}
                        </span>
                        {isUnread && (
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>

                      <h3 className="text-sm font-semibold truncate">
                        {item.title}
                      </h3>

                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {item.message}
                      </p>

                      <div className="pt-1 text-[11px] text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString("vi-VN")}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {item.entityId && item.entityType === "task" && (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2.5"
                      >
                        <Link href={`/tasks/${item.entityId}`}>Xem việc</Link>
                      </Button>
                    )}

                    {isUnread && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkOneRead(item.id)}
                        disabled={markingIds.has(item.id)}
                        className="h-7 text-[11px] text-muted-foreground hover:text-foreground px-2"
                      >
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Đã đọc
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={data.page <= 1}
            onClick={() => handlePageChange(data.page - 1)}
          >
            Trang trước
          </Button>
          <span className="text-xs text-muted-foreground px-2">
            Trang {data.page} / {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={data.page >= data.totalPages}
            onClick={() => handlePageChange(data.page + 1)}
          >
            Trang sau
          </Button>
        </div>
      )}
    </div>
  );
}
