import { z } from "zod";

export const createBrandSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Tên brand không được để trống.")
      .max(100, "Tên brand tối đa 100 ký tự."),
  })
  .strict();

export type CreateBrandInput = z.infer<typeof createBrandSchema>;
