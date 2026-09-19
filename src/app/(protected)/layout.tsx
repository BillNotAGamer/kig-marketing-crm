import Link from "next/link";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeControls } from "@/components/theme-controls";
import { MobileBottomNav } from "@/components/navigation/mobile-nav";
import { getNotifications } from "@/lib/notifications/server";
import { NotificationBell } from "@/components/notifications/notification-bell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireSession();
  const headerList = new Headers(await headers());
  let unreadCount = 0;
  try {
    unreadCount = await getNotifications().getUnreadCount(headerList);
  } catch {
    unreadCount = 0;
  }

  return (
    <div className="min-h-svh">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8">
          <Link href="/app" className="text-lg font-semibold">
            KIG Marketing CRM
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <NotificationBell unreadCount={unreadCount} />
            <span className="text-sm">
              {actor.name} · {actor.role}
            </span>
            <LogoutButton />
          </div>
          <nav
            aria-label="Application"
            className="flex w-full flex-wrap gap-4 text-sm"
          >
            <Link
              className="py-2 underline-offset-4 hover:underline"
              href="/app"
            >
              Home
            </Link>
            <Link
              className="py-2 underline-offset-4 hover:underline"
              href="/dashboard"
            >
              Dashboard
            </Link>
            <Link
              className="py-2 underline-offset-4 hover:underline"
              href="/tasks"
            >
              Tasks
            </Link>
            <Link
              className="py-2 underline-offset-4 hover:underline"
              href="/calendar"
            >
              Calendar
            </Link>
            <Link
              className="py-2 underline-offset-4 hover:underline"
              href="/reports"
            >
              Reports
            </Link>
            <Link
              className="py-2 underline-offset-4 hover:underline"
              href="/search"
            >
              Search
            </Link>
            {actor.role === "HEAD" && (
              <>
                <Link
                  className="py-2 underline-offset-4 hover:underline"
                  href="/audit"
                >
                  Audit Log
                </Link>
                <Link
                  className="py-2 underline-offset-4 hover:underline"
                  href="/users"
                >
                  User Management
                </Link>
                <Link
                  className="py-2 underline-offset-4 hover:underline"
                  href="/account/password"
                >
                  Change own password
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 pb-24 sm:px-8 sm:pb-8">
        {children}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-20 sm:px-8 sm:pb-8">
        <ThemeControls />
      </footer>
      <MobileBottomNav role={actor.role} />
    </div>
  );
}
