INSERT INTO "user" ("id", "name", "email", "email_verified", "role", "banned", "ban_reason", "created_at", "updated_at")
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Người dùng đã xóa',
  'deleted-user@system.invalid',
  false,
  'EMPLOYEE',
  true,
  'System sentinel for deleted historical users',
  now(),
  now()
)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "audit_log" DROP CONSTRAINT IF EXISTS "audit_log_actor_user_id_user_id_fk";
