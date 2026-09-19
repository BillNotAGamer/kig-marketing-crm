import { headers } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { getNotifications } from "@/lib/notifications/server";
import { DesktopSidebar } from "@/components/navigation/desktop-sidebar";
import { DesktopHeader } from "@/components/navigation/desktop-header";
import { MobileBottomNav } from "@/components/navigation/mobile-nav";

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
    <div className="flex min-h-svh bg-background">
      {/* Desktop Left Sidebar (lg and above) */}
      <DesktopSidebar actor={actor} />

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <DesktopHeader unreadCount={unreadCount} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 space-y-6 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation (below lg) */}
      <MobileBottomNav role={actor.role} />
    </div>
  );
}
