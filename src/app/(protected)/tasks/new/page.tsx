import Link from "next/link";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { getTasks } from "@/lib/tasks/server";
import { currentBusinessDate } from "@/lib/tasks/validation";
import { TaskForm } from "@/components/tasks/task-form";

export default async function CreateTaskPage() {
  const actor = await requireSession();
  const options = await getTasks().listAssignees(new Headers(await headers()));
  return (
    <>
      <Link href="/tasks" className="text-sm underline">
        Back to tasks
      </Link>
      <h1 className="text-3xl font-semibold">Create task</h1>
      <TaskForm
        options={options}
        employee={actor.role === "EMPLOYEE"}
        assignedDate={currentBusinessDate()}
      />
    </>
  );
}
