import { headers } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { getNotifications } from "@/lib/notifications/server";
import { roleDisplay } from "@/lib/ui-labels";
import { NotificationsView } from "@/components/notifications/notifications-view";

export default async function NotificationsPage(props: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const actor = await requireSession();
  const searchParams = await props.searchParams;

  const data = await getNotifications().listNotifications(
    new Headers(await headers()),
    searchParams,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Trung tâm thông báo
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Thông báo cá nhân của {actor.name} ·{" "}
          {roleDisplay[actor.role] ?? actor.role}
        </p>
      </div>

      <NotificationsView initialData={data} />
    </div>
  );
}
