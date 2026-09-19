import { z } from "zod";

const postgresUrl = z
  .string()
  .url()
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "postgres:" || protocol === "postgresql:";
    } catch {
      return false;
    }
  });
const driveId = z.string().regex(/^[A-Za-z0-9_-]{3,200}$/);
export const serverEnvSchema = z
  .object({
    DATABASE_URL: postgresUrl,
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z
      .string()
      .url()
      .refine((value) => {
        try {
          return ["http:", "https:"].includes(new URL(value).protocol);
        } catch {
          return false;
        }
      }),
    KIG_DATABASE_ENV: z.enum(["development", "test", "production"]),
    GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL: z.string().email().optional(),
    GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().min(1).optional(),
    GOOGLE_DRIVE_SHARED_DRIVE_ID: driveId.optional(),
    GOOGLE_DRIVE_ALLOWED_FOLDER_ID: driveId.optional(),
  })
  .superRefine((value, context) => {
    const email = Boolean(value.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL);
    const key = Boolean(value.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY);
    if (email !== key)
      context.addIssue({
        code: "custom",
        path: ["GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL"],
        message: "Drive credentials must be complete.",
      });
    if (value.KIG_DATABASE_ENV === "production") {
      const url = new URL(value.BETTER_AUTH_URL);
      const isLoopback = ["localhost", "127.0.0.1"].includes(url.hostname);
      if (url.protocol !== "https:" && !isLoopback)
        context.addIssue({
          code: "custom",
          path: ["BETTER_AUTH_URL"],
          message: "Production URL must use HTTPS.",
        });
      if (
        /(change-me|example|development|default)/i.test(
          value.BETTER_AUTH_SECRET,
        )
      )
        context.addIssue({
          code: "custom",
          path: ["BETTER_AUTH_SECRET"],
          message: "Placeholder secret is forbidden.",
        });
      if (
        email &&
        !value.GOOGLE_DRIVE_ALLOWED_FOLDER_ID &&
        !value.GOOGLE_DRIVE_SHARED_DRIVE_ID
      )
        context.addIssue({
          code: "custom",
          path: ["GOOGLE_DRIVE_ALLOWED_FOLDER_ID"],
          message:
            "Production Drive requires an allowed folder or Shared Drive boundary.",
        });
    }
  });
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(
  values: Readonly<Record<string, string | undefined>>,
): ServerEnv {
  const result = serverEnvSchema.safeParse(values);
  if (!result.success) {
    // Never include rejected values or full Zod issues in errors/logs.
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path[0])),
    ];
    throw new Error(
      `Invalid or missing server environment: ${fields.join(", ")}`,
    );
  }
  return result.data;
}
