import { headers } from "next/headers";
import { requireRole } from "@/lib/auth/session";
import { getDb } from "@/db";
import { getServerEnv } from "@/lib/env";
import { userService } from "@/lib/users/service";
import { UserManagement } from "@/components/users/user-management";

export default async function UsersPage() {
  const actor = await requireRole("HEAD");
  const users = await userService(getDb(), getServerEnv()).list(
    new Headers(await headers()),
  );
  return (
    <>
      <div>
        <h1 className="text-3xl font-semibold">User Management</h1>
        <p className="mt-2 text-muted-foreground">
          Manage identities, access and credentials through separate
          administrative actions.
        </p>
      </div>
      <UserManagement users={users} actorId={actor.id} />
    </>
  );
}
