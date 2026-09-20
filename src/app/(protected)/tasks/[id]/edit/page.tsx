import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { requireRole } from "@/lib/auth/session";
import { readTaskPage } from "@/lib/tasks/page";
import { getBrands } from "@/lib/brands/server";
import { TaskForm } from "@/components/tasks/task-form";

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMIN", "HEAD"]);
  const task = await readTaskPage((await params).id);
  if (task.status !== "OPEN") notFound();
  const brands = await getBrands().listBrands(new Headers(await headers()));
  return (
    <>
      <Link href={`/tasks/${task.id}`} className="text-sm underline">
        Quay lại chi tiết công việc
      </Link>
      <h1 className="text-3xl font-semibold">Chỉnh sửa công việc</h1>
      <TaskForm
        task={task}
        options={[]}
        brands={brands}
        employee={false}
        assignedDate={task.assignedDate}
      />
    </>
  );
}
