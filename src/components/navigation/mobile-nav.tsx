"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck2,
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  MoreHorizontal,
  BarChart3,
  Search,
  Bell,
  ScrollText,
  Users,
  KeyRound,
  X,
} from "lucide-react";
import { isRouteActive } from "./nav-utils";
import { ThemeControls } from "@/components/theme-controls";
import { LogoutButton } from "@/components/auth/logout-button";
import { cn } from "cn";

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
    icon: ClipboardList,
  },
  {
    label: "Lịch",
    href: "/calendar",
    icon: CalendarDays,
  },
];

export function MobileBottomNav({ role }: { role?: string }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const closeMore = useCallback(() => setMoreOpen(false), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && moreOpen) {
        closeMore();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moreOpen, closeMore]);

  const isMoreActive =
    pathname.startsWith("/reports") ||
    pathname.startsWith("/search") ||
    pathname.startsWith("/notifications") ||
    pathname.startsWith("/audit") ||
    pathname.startsWith("/users") ||
    pathname.startsWith("/account/password");

  return (
    <>
      {moreOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
          onClick={closeMore}
        />
      )}

      {moreOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Thực đơn bổ sung"
          className="fixed bottom-16 left-0 right-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t bg-card p-4 pb-6 shadow-2xl lg:hidden space-y-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-sm font-semibold text-foreground">
              Chức năng mở rộng
            </span>
            <button
              type="button"
              onClick={closeMore}
              className="flex h-9 w-9 items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Đóng thực đơn"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Operational routes */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Công việc & Tiện ích
            </span>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/reports"
                onClick={closeMore}
                aria-current={
                  isRouteActive(pathname, "/reports") ? "page" : undefined
                }
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-lg border p-2.5 text-xs font-medium transition-colors",
                  isRouteActive(pathname, "/reports")
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border hover:bg-muted text-foreground",
                )}
              >
                <BarChart3 className="h-4 w-4 shrink-0" />
                <span className="truncate">Báo cáo</span>
              </Link>
              <Link
                href="/search"
                onClick={closeMore}
                aria-current={
                  isRouteActive(pathname, "/search") ? "page" : undefined
                }
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-lg border p-2.5 text-xs font-medium transition-colors",
                  isRouteActive(pathname, "/search")
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border hover:bg-muted text-foreground",
                )}
              >
                <Search className="h-4 w-4 shrink-0" />
                <span className="truncate">Tìm kiếm</span>
              </Link>
              <Link
                href="/notifications"
                onClick={closeMore}
                aria-current={
                  isRouteActive(pathname, "/notifications") ? "page" : undefined
                }
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-lg border p-2.5 text-xs font-medium transition-colors",
                  isRouteActive(pathname, "/notifications")
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border hover:bg-muted text-foreground",
                )}
              >
                <Bell className="h-4 w-4 shrink-0" />
                <span className="truncate">Thông báo</span>
              </Link>
            </div>
          </div>

          {/* Admin routes */}
          {(role === "ADMIN" || role === "HEAD" || role === "DEPUTY") && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Quản trị hệ thống
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(role === "ADMIN" || role === "HEAD") && (
                  <Link
                    href="/audit"
                    onClick={closeMore}
                    aria-current={
                      isRouteActive(pathname, "/audit") ? "page" : undefined
                    }
                    className={cn(
                      "flex min-h-11 items-center gap-2.5 rounded-lg border p-2.5 text-xs font-medium transition-colors",
                      isRouteActive(pathname, "/audit")
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border hover:bg-muted text-foreground",
                    )}
                  >
                    <ScrollText className="h-4 w-4 shrink-0" />
                    <span className="truncate">Nhật ký hệ thống</span>
                  </Link>
                )}
                <Link
                  href="/users"
                  onClick={closeMore}
                  aria-current={
                    isRouteActive(pathname, "/users") ? "page" : undefined
                  }
                  className={cn(
                    "flex min-h-11 items-center gap-2.5 rounded-lg border p-2.5 text-xs font-medium transition-colors",
                    isRouteActive(pathname, "/users")
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border hover:bg-muted text-foreground",
                  )}
                >
                  <Users className="h-4 w-4 shrink-0" />
                  <span className="truncate">Quản lý người dùng</span>
                </Link>
              </div>
            </div>
          )}

          {/* Account section */}
          <div className="space-y-2 border-t pt-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Tài khoản & Thiết lập
            </span>
            <Link
              href="/account/password"
              onClick={closeMore}
              aria-current={
                pathname.startsWith("/account/password") ? "page" : undefined
              }
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-lg border p-2.5 text-xs font-medium transition-colors",
                pathname.startsWith("/account/password")
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : "border-border hover:bg-muted text-foreground",
              )}
            >
              <KeyRound className="h-4 w-4 shrink-0" />
              <span>Đổi mật khẩu</span>
            </Link>

            <ThemeControls />

            <div className="pt-1">
              <LogoutButton variant="outline" />
            </div>
          </div>
        </div>
      )}

      {/* Primary Bottom Navigation Bar */}
      <nav
        aria-label="Thanh điều hướng di động"
        className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <div className="flex h-16 items-stretch justify-around px-1">
          {primaryNavItems.map((item) => {
            const isActive = isRouteActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
                  isActive
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
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
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
              isMoreActive || moreOpen
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="truncate">Thêm</span>
          </button>
        </div>
      </nav>
    </>
  );
}
