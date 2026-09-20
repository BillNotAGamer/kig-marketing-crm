"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck2,
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  BarChart3,
  Search,
  ScrollText,
  Users,
  KeyRound,
} from "lucide-react";
import type { Actor } from "@/lib/auth/session-core";
import { isRouteActive } from "./nav-utils";
import { ThemeControls } from "@/components/theme-controls";
import { LogoutButton } from "@/components/auth/logout-button";
import { KigLogo } from "@/components/ui/kig-logo";
import { cn } from "cn";
import { roleDisplay } from "@/lib/ui-labels";

interface DesktopSidebarProps {
  actor: Actor;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const operationalItems: NavItem[] = [
  { label: "Hôm nay", href: "/app", icon: CalendarCheck2 },
  { label: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
  { label: "Công việc", href: "/tasks", icon: ClipboardList },
  { label: "Lịch", href: "/calendar", icon: CalendarDays },
  { label: "Báo cáo", href: "/reports", icon: BarChart3 },
  { label: "Tìm kiếm", href: "/search", icon: Search },
];

export function DesktopSidebar({ actor }: DesktopSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Desktop Navigation"
      className="hidden lg:flex lg:w-64 lg:flex-col lg:shrink-0 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto border-r bg-card text-card-foreground"
    >
      {/* Sidebar Branding */}
      <div className="flex shrink-0 flex-col items-center justify-center border-b px-6 py-5">
        <Link
          href="/app"
          className="group flex flex-col items-center gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="KIG Marketing CRM"
        >
          <KigLogo width={150} height={108} priority className="w-[145px]" />
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase transition-colors group-hover:text-primary">
            Marketing CRM
          </span>
        </Link>
      </div>

      {/* Navigation Sections */}
      <nav
        aria-label="Sidebar main navigation"
        className="flex-1 space-y-6 px-3 py-4"
      >
        {/* Operational Section */}
        <div>
          <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            CÔNG VIỆC
          </div>
          <div className="space-y-1">
            {operationalItems.map((item) => {
              const active = isRouteActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-l-2 border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Admin Section */}
        {(() => {
          const canViewAudit = actor.role === "ADMIN" || actor.role === "HEAD";
          const canViewUsers =
            actor.role === "ADMIN" ||
            actor.role === "HEAD" ||
            actor.role === "DEPUTY";
          const visibleAdminItems = [
            ...(canViewAudit
              ? [
                  {
                    label: "Nhật ký hệ thống",
                    href: "/audit",
                    icon: ScrollText,
                  },
                ]
              : []),
            ...(canViewUsers
              ? [{ label: "Quản lý người dùng", href: "/users", icon: Users }]
              : []),
          ];
          if (visibleAdminItems.length === 0) return null;
          return (
            <div>
              <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                QUẢN TRỊ
              </div>
              <div className="space-y-1">
                {visibleAdminItems.map((item) => {
                  const active = isRouteActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "border-l-2 border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </nav>

      {/* Account Section at Bottom */}
      <div className="shrink-0 border-t bg-card/50 p-4 space-y-3">
        {/* User Identity */}
        <div className="flex items-center justify-between gap-2 px-1">
          <span
            className="text-sm font-semibold text-foreground truncate"
            title={actor.name}
          >
            {actor.name}
          </span>
          <span
            className="shrink-0 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary"
            title={roleDisplay[actor.role] ?? actor.role}
          >
            {actor.role}
          </span>
        </div>

        {/* Change Password Link */}
        <Link
          href="/account/password"
          aria-current={
            pathname.startsWith("/account/password") ? "page" : undefined
          }
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            pathname.startsWith("/account/password")
              ? "bg-primary/10 text-primary font-semibold"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          <KeyRound className="h-3.5 w-3.5 shrink-0" />
          <span>Đổi mật khẩu</span>
        </Link>

        {/* Theme Controls */}
        <ThemeControls />

        {/* Logout */}
        <LogoutButton variant="ghost" />
      </div>
    </aside>
  );
}
