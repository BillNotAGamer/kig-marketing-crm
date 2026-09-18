import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AccessError } from "../auth/permissions";
import { getTasks } from "./server";

export async function readTaskPage(id: string) {
  try {
    return await getTasks().getTask(new Headers(await headers()), id);
  } catch (error: unknown) {
    if (error instanceof AccessError && error.status === 404) notFound();
    // Invalid IDs also reveal no resource data.
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      notFound();
    throw error;
  }
}
