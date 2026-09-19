"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  CalendarCheck2,
  LayoutDashboard,
  ListTodo,
  MoreHorizontal,
  BarChart3,
  Search,
  Bell,
  ShieldAlert,
  X,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const primaryNavItems: NavItem[] = [
  {
    label: "Hôm nay",
    href: "/app",
    icon: CalendarCheck2,
  },
  {
    label: "Tổng quan",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Công việc",
    href: "/tasks",
    icon: ListTodo,
  },
  {
    label: "Lịch",
    href: "/calendar",
    icon: Calendar,
  },
];

export function MobileBottomNav({ role }: { role?: string }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive =
    pathname.startsWith("/reports") ||
    pathname.startsWith("/search") ||
    pathname.startsWith("/notifications") ||
    pathname.startsWith("/audit");

  return (
    <>
      {moreOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs sm:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {moreOpen && (
        <div
          role="dialog"
          aria-label="Thực đơn bổ sung"
          className="fixed bottom-16 left-0 right-0 z-50 rounded-t-2xl border-t bg-card p-4 shadow-xl sm:hidden"
        >
          <div className="mb-3 flex items-center justify-between border-b pb-2">
            <span className="text-sm font-semibold">Chức năng mở rộng</span>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Đóng thực đơn"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/reports"
              onClick={() => setMoreOpen(false)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-sm font-medium transition-colors ${
                pathname.startsWith("/reports")
                  ? "border-primary bg-primary/10 text-primary"
                  : "hover:bg-muted"
              }`}
            >
              <BarChart3 className="h-5 w-5" />
              <span>Báo cáo</span>
            </Link>
            <Link
              href="/search"
              onClick={() => setMoreOpen(false)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-sm font-medium transition-colors ${
                pathname.startsWith("/search")
                  ? "border-primary bg-primary/10 text-primary"
                  : "hover:bg-muted"
              }`}
            >
              <Search className="h-5 w-5" />
              <span>Tìm kiếm</span>
            </Link>
            <Link
              href="/notifications"
              onClick={() => setMoreOpen(false)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-sm font-medium transition-colors ${
                pathname.startsWith("/notifications")
                  ? "border-primary bg-primary/10 text-primary"
                  : "hover:bg-muted"
              }`}
            >
              <Bell className="h-5 w-5" />
              <span>Thông báo</span>
            </Link>
            {role === "HEAD" && (
              <Link
                href="/audit"
                onClick={() => setMoreOpen(false)}
                className={`flex items-center gap-3 rounded-lg border p-3 text-sm font-medium transition-colors ${
                  pathname.startsWith("/audit")
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-muted"
                }`}
              >
                <ShieldAlert className="h-5 w-5" />
                <span>Kiểm toán</span>
              </Link>
            )}
          </div>
        </div>
      )}

      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        <div className="flex h-16 items-stretch justify-around px-1">
          {primaryNavItems.map((item) => {
            const isActive =
              item.href === "/app"
                ? pathname === "/app"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(!moreOpen)}
            aria-expanded={moreOpen}
            className={`flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
              isMoreActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="truncate">Thêm</span>
          </button>
        </div>
      </nav>
    </>
  );
}
