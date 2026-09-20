ALTER TABLE "user" DROP CONSTRAINT "user_role_valid";
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_role_valid" CHECK ("user"."role" IN ('ADMIN', 'HEAD', 'DEPUTY', 'EMPLOYEE'));
