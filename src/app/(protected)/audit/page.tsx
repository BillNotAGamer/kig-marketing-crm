import { headers } from "next/headers";
import { requireRole } from "@/lib/auth/session";
import { getAudit } from "@/lib/audit/server";
import { AuditView } from "@/components/audit/audit-view";

export default async function AuditPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole("HEAD");
  const searchParams = await props.searchParams;

  const data = await getAudit().listAuditLogs(
    new Headers(await headers()),
    searchParams,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Nhật ký hệ thống (Audit Log)
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bản ghi kiểm toán chỉ dành riêng cho Quản trị viên (HEAD)
        </p>
      </div>

      <AuditView initialData={data} />
    </div>
  );
}
