import { eq, sql } from "drizzle-orm";
import { brand, auditLog } from "@/db/schema";
import type { AuthDatabase, Transaction } from "../auth/factory";
import { createAuth } from "../auth/factory";
import { authorizedActor, type Actor } from "../auth/session-core";
import { AccessError } from "../auth/permissions";
import type { ServerEnv } from "../env-schema";
import { normalizeBrandName } from "./normalization";
import { createBrandSchema } from "./validation";
import { requireCreateBrandPermission } from "./policy";
import type { BrandDTO } from "./types";

export function brandService(db: AuthDatabase, env: ServerEnv) {
  async function execute<T>(
    headers: Headers,
    mutation: boolean,
    work: (tx: Transaction, actor: Actor) => Promise<T>,
  ) {
    return db.transaction(async (tx) => {
      await tx.execute(
        mutation
          ? sql`SELECT pg_advisory_xact_lock(24091802)`
          : sql`SELECT pg_advisory_xact_lock_shared(24091802)`,
      );
      const actor = await authorizedActor(tx, createAuth(tx, env), headers);
      return work(tx, actor);
    });
  }

  return {
    listBrands: (headers: Headers) =>
      execute(headers, false, async (tx): Promise<BrandDTO[]> => {
        const rows = await tx
          .select({
            id: brand.id,
            name: brand.name,
            normalizedName: brand.normalizedName,
            createdAt: brand.createdAt,
          })
          .from(brand)
          .orderBy(brand.name);

        return rows.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        }));
      }),

    createBrand: (headers: Headers, input: unknown) =>
      execute(headers, true, async (tx, actor): Promise<BrandDTO> => {
        requireCreateBrandPermission(actor);

        const parsed = createBrandSchema.parse(input);
        const cleanName = parsed.name.trim().replace(/\s+/g, " ");
        const normalized = normalizeBrandName(cleanName);

        const [existing] = await tx
          .select({ id: brand.id })
          .from(brand)
          .where(eq(brand.normalizedName, normalized));

        if (existing) {
          throw new AccessError(409, "Brand này đã tồn tại.");
        }

        const [created] = await tx
          .insert(brand)
          .values({
            name: cleanName,
            normalizedName: normalized,
            createdById: actor.id,
          })
          .returning();

        await tx.insert(auditLog).values({
          actorUserId: actor.id,
          action: "CREATE_BRAND",
          entityType: "brand",
          entityId: created.id,
          afterData: {
            brandId: created.id,
            brandName: created.name,
          },
        });

        return {
          id: created.id,
          name: created.name,
          normalizedName: created.normalizedName,
          createdAt: created.createdAt.toISOString(),
        };
      }),
  };
}
