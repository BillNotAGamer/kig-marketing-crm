CREATE TABLE "brand" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"normalized_name" varchar(100) NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_name_nonempty" CHECK (length(trim("brand"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "brand_id" uuid;--> statement-breakpoint
ALTER TABLE "brand" ADD CONSTRAINT "brand_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brand_normalized_name_unique" ON "brand" USING btree ("normalized_name");--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_brand_idx" ON "task" USING btree ("brand_id") WHERE "task"."deleted_at" IS NULL;--> statement-breakpoint
INSERT INTO "brand" ("id", "name", "normalized_name", "created_by_id", "created_at")
VALUES
  (gen_random_uuid(), 'Truyền Thuyết Champong', 'truyền thuyết champong', (SELECT "id" FROM "user" WHERE "role" = 'HEAD' AND "banned" = false ORDER BY "created_at" ASC LIMIT 1), now()),
  (gen_random_uuid(), 'GOGI MARU', 'gogi maru', (SELECT "id" FROM "user" WHERE "role" = 'HEAD' AND "banned" = false ORDER BY "created_at" ASC LIMIT 1), now()),
  (gen_random_uuid(), 'KBB COOK', 'kbb cook', (SELECT "id" FROM "user" WHERE "role" = 'HEAD' AND "banned" = false ORDER BY "created_at" ASC LIMIT 1), now()),
  (gen_random_uuid(), 'SEOUL GUKBAP', 'seoul gukbap', (SELECT "id" FROM "user" WHERE "role" = 'HEAD' AND "banned" = false ORDER BY "created_at" ASC LIMIT 1), now())
ON CONFLICT ("normalized_name") DO NOTHING;