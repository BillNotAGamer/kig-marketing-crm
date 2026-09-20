import type { AppRole } from "../auth/roles";
import type { Actor } from "../auth/session-core";
import { AccessError } from "../auth/permissions";

export function canCreateBrand(role: AppRole): boolean {
  return role === "ADMIN" || role === "HEAD" || role === "DEPUTY";
}

export function canReadBrands(role: AppRole): boolean {
  return (
    role === "ADMIN" ||
    role === "HEAD" ||
    role === "DEPUTY" ||
    role === "EMPLOYEE"
  );
}

export function requireCreateBrandPermission(actor: Actor): void {
  if (!canCreateBrand(actor.role)) {
    throw new AccessError(
      403,
      "Chỉ ADMIN, HEAD hoặc DEPUTY mới có quyền tạo Brand mới.",
    );
  }
}
