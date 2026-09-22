import { headers } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { getSearch } from "@/lib/search/server";
import { SearchView } from "@/components/search/search-view";

export default async function SearchPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireSession();
  const searchParams = await props.searchParams;

  const data = await getSearch().searchTasks(
    new Headers(await headers()),
    searchParams,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Tìm kiếm công việc
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tìm kiếm toàn bộ công việc trong nhóm
        </p>
      </div>

      <SearchView initialData={data} isTeamReader={true} />
    </div>
  );
}
