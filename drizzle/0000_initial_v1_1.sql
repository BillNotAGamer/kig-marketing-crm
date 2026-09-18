CREATE TYPE "public"."notification_type" AS ENUM('TASK_ASSIGNED', 'TASK_UPDATED', 'TASK_REASSIGNED', 'TASK_CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."task_asset_provider" AS ENUM('GOOGLE_DRIVE');--> statement-breakpoint
CREATE TYPE "public"."task_asset_type" AS ENUM('IMAGE', 'VIDEO', 'DOCUMENT', 'SPREADSHEET', 'PRESENTATION', 'PDF', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TYPE "public"."task_progress_status" AS ENUM('COMPLETED', 'NOT_COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('OPEN', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text DEFAULT 'EMPLOYEE' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_role_valid" CHECK ("user"."role" IN ('HEAD', 'DEPUTY', 'EMPLOYEE'))
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'OPEN' NOT NULL,
	"priority" "task_priority" DEFAULT 'NORMAL' NOT NULL,
	"assigned_date" date NOT NULL,
	"due_date" date,
	"created_by_id" uuid NOT NULL,
	"assigned_to_id" uuid NOT NULL,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "task_title_nonempty" CHECK (length(trim("task"."title")) > 0),
	CONSTRAINT "task_date_order" CHECK ("task"."due_date" IS NULL OR "task"."due_date" >= "task"."assigned_date"),
	CONSTRAINT "task_lifecycle_consistent" CHECK (("task"."status" = 'OPEN' AND "task"."completed_at" IS NULL AND "task"."cancelled_at" IS NULL) OR ("task"."status" = 'COMPLETED' AND "task"."completed_at" IS NOT NULL AND "task"."cancelled_at" IS NULL) OR ("task"."status" = 'CANCELLED' AND "task"."cancelled_at" IS NOT NULL AND "task"."completed_at" IS NULL)),
	CONSTRAINT "task_delete_actor_paired" CHECK (("task"."deleted_at" IS NULL AND "task"."deleted_by_id" IS NULL) OR ("task"."deleted_at" IS NOT NULL AND "task"."deleted_by_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "task_daily_update" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"report_date" date NOT NULL,
	"status" "task_progress_status" NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"corrected_at" timestamp with time zone,
	"corrected_by_id" uuid,
	"correction_reason" text,
	CONSTRAINT "task_daily_update_task_date_unique" UNIQUE("task_id","report_date"),
	CONSTRAINT "task_daily_update_reason_consistent" CHECK (("task_daily_update"."status" = 'NOT_COMPLETED' AND "task_daily_update"."reason" IS NOT NULL AND length(trim("task_daily_update"."reason")) > 0) OR ("task_daily_update"."status" = 'COMPLETED' AND "task_daily_update"."reason" IS NULL)),
	CONSTRAINT "task_daily_update_correction_consistent" CHECK (("task_daily_update"."corrected_at" IS NULL AND "task_daily_update"."corrected_by_id" IS NULL AND "task_daily_update"."correction_reason" IS NULL) OR ("task_daily_update"."corrected_at" IS NOT NULL AND "task_daily_update"."corrected_by_id" IS NOT NULL AND "task_daily_update"."correction_reason" IS NOT NULL AND length(trim("task_daily_update"."correction_reason")) > 0))
);
--> statement-breakpoint
CREATE TABLE "task_asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"provider" "task_asset_provider" NOT NULL,
	"provider_file_id" varchar(255) NOT NULL,
	"source_url" text NOT NULL,
	"file_name" varchar(512),
	"mime_type" varchar(255),
	"asset_type" "task_asset_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "task_asset_provider_id_nonempty" CHECK (length(trim("task_asset"."provider_file_id")) > 0),
	CONSTRAINT "task_asset_source_url_nonempty" CHECK (length(trim("task_asset"."source_url")) > 0),
	CONSTRAINT "task_asset_delete_actor_paired" CHECK (("task_asset"."deleted_at" IS NULL AND "task_asset"."deleted_by_id" IS NULL) OR ("task_asset"."deleted_at" IS NOT NULL AND "task_asset"."deleted_by_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"entity_type" varchar(50),
	"entity_id" varchar(255),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_title_nonempty" CHECK (length(trim("notification"."title")) > 0),
	CONSTRAINT "notification_message_nonempty" CHECK (length(trim("notification"."message")) > 0)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(255),
	"before_data" jsonb,
	"after_data" jsonb,
	"metadata" jsonb,
	"request_id" varchar(100),
	"ip_address" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_log_action_nonempty" CHECK (length(trim("audit_log"."action")) > 0),
	CONSTRAINT "audit_log_entity_type_nonempty" CHECK (length(trim("audit_log"."entity_type")) > 0)
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assigned_to_id_user_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_deleted_by_id_user_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_daily_update" ADD CONSTRAINT "task_daily_update_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_daily_update" ADD CONSTRAINT "task_daily_update_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_daily_update" ADD CONSTRAINT "task_daily_update_corrected_by_id_user_id_fk" FOREIGN KEY ("corrected_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_asset" ADD CONSTRAINT "task_asset_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_asset" ADD CONSTRAINT "task_asset_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_asset" ADD CONSTRAINT "task_asset_deleted_by_id_user_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "task_assignee_date_active_idx" ON "task" USING btree ("assigned_to_id","assigned_date") WHERE "task"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "task_assignee_status_active_idx" ON "task" USING btree ("assigned_to_id","status") WHERE "task"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "task_status_date_active_idx" ON "task" USING btree ("status","assigned_date") WHERE "task"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "task_due_date_active_idx" ON "task" USING btree ("due_date") WHERE "task"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "task_creator_idx" ON "task" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "task_daily_update_user_date_idx" ON "task_daily_update" USING btree ("user_id","report_date");--> statement-breakpoint
CREATE INDEX "task_asset_task_active_idx" ON "task_asset" USING btree ("task_id") WHERE "task_asset"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "task_asset_active_file_unique" ON "task_asset" USING btree ("task_id","provider","provider_file_id") WHERE "task_asset"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "notification_user_read_created_idx" ON "notification" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_created_idx" ON "audit_log" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_entity_created_idx" ON "audit_log" USING btree ("entity_type","entity_id","created_at");