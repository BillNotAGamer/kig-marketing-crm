import Link from "next/link";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { getTasks } from "@/lib/tasks/server";
import { getBrands } from "@/lib/brands/server";
import { currentBusinessDate } from "@/lib/tasks/validation";
import { TaskForm } from "@/components/tasks/task-form";

export default async function CreateTaskPage() {
  const actor = await requireSession();
  const reqHeaders = new Headers(await headers());
  const options = await getTasks().listAssignees(reqHeaders);
  const brands = await getBrands().listBrands(reqHeaders);
  return (
    <>
      <Link href="/tasks" className="text-sm underline">
        Quay lại danh sách công việc
      </Link>
      <h1 className="text-3xl font-semibold">Tạo công việc</h1>
      <TaskForm
        options={options}
        brands={brands}
        employee={actor.role === "EMPLOYEE"}
        assignedDate={currentBusinessDate()}
      />
    </>
  );
}
