import { headers } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { permitsTask } from "@/lib/tasks/policy";
import { getSearch } from "@/lib/search/server";
import { SearchView } from "@/components/search/search-view";

export default async function SearchPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await requireSession();
  const searchParams = await props.searchParams;

  const data = await getSearch().searchTasks(
    new Headers(await headers()),
    searchParams,
  );

  const isTeamReader = permitsTask(actor.role, "task:read-team");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Tìm kiếm công việc
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isTeamReader
            ? "Tìm kiếm toàn bộ công việc trong nhóm"
            : "Tìm kiếm các công việc được phân công cho bạn"}
        </p>
      </div>

      <SearchView initialData={data} isTeamReader={isTeamReader} />
    </div>
  );
}
