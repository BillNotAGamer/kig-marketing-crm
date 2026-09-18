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
export const serverEnvSchema = z.object({
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
