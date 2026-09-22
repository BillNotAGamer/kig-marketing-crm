export const DELETED_USER_SENTINEL_ID = "00000000-0000-0000-0000-000000000000";
export const DELETED_USER_SENTINEL_NAME = "Người dùng đã xóa";
export const DELETED_USER_SENTINEL_EMAIL = "deleted-user@system.invalid";

export function isSentinelUserId(id: string | null | undefined): boolean {
  return id === DELETED_USER_SENTINEL_ID;
}
