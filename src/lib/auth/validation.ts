import { z } from "zod";
import { appRoleValues } from "./roles";

export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Use at most 128 characters.")
  .refine((value) => value.trim().length > 0, "Password cannot be blank.");
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const nameSchema = z.string().trim().min(1).max(100);
export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
    callbackURL: z.enum(["/app", "/dashboard"]).optional(),
  })
  .strict();
export const createUserSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    role: z.enum(["DEPUTY", "EMPLOYEE"]),
    password: passwordSchema,
  })
  .strict();
export const userCommandSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("update"),
      name: nameSchema,
      email: emailSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("change-role"),
      role: z.enum(appRoleValues),
    })
    .strict(),
  z.object({ operation: z.literal("disable") }).strict(),
  z.object({ operation: z.literal("enable") }).strict(),
  z
    .object({
      operation: z.literal("reset-password"),
      password: passwordSchema,
    })
    .strict(),
]);
export const ownPasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
  })
  .strict();
export const userIdSchema = z.string().uuid();
export type UserCommand = z.infer<typeof userCommandSchema>;
