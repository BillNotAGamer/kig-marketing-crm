import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { getAuth } from "@/lib/auth";
import { currentActor } from "./session-core";

export const getCurrentSession = cache(async () =>
  currentActor(getDb(), getAuth(), new Headers(await headers())),
);
export async function requireSession() {
  const actor = await getCurrentSession();
  if (!actor) redirect("/login");
  return actor;
}
export async function requireRole(role: "HEAD") {
  const actor = await requireSession();
  if (actor.role !== role) redirect("/access-denied");
  return actor;
}
