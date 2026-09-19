"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { getPageTitle } from "./nav-utils";

interface DesktopHeaderProps {
  unreadCount: number;
}

export function DesktopHeader({ unreadCount }: DesktopHeaderProps) {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b bg-card/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      {/* Mobile view branding (below lg) */}
      <div className="flex items-center gap-2 lg:hidden">
        <Link
          href="/app"
          className="text-base font-bold tracking-tight text-foreground"
        >
          KIG Marketing CRM
        </Link>
      </div>

      {/* Desktop view page title (lg and above) */}
      <div className="hidden lg:flex lg:items-center">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          {pageTitle}
        </h1>
      </div>

      {/* Right side actions: Notification Bell */}
      <div className="flex items-center gap-3">
        <NotificationBell unreadCount={unreadCount} />
      </div>
    </header>
  );
}
