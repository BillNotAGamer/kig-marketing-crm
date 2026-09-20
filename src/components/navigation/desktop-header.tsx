"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { KigLogo } from "@/components/ui/kig-logo";
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
          className="flex items-center gap-2.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="KIG Marketing CRM"
        >
          <KigLogo width={96} height={69} className="h-7 w-auto" />
          <span className="text-sm font-bold tracking-tight text-foreground">
            Marketing CRM
          </span>
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
