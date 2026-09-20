import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { getAuth } from "@/lib/auth";
import { currentActor } from "./session-core";
import type { AppRole } from "./roles";

export const getCurrentSession = cache(async () =>
  currentActor(getDb(), getAuth(), new Headers(await headers())),
);
export async function requireSession() {
  const actor = await getCurrentSession();
  if (!actor) redirect("/login");
  return actor;
}
export async function requireRole(role: AppRole | readonly AppRole[]) {
  const actor = await requireSession();
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(actor.role)) redirect("/access-denied");
  return actor;
}
