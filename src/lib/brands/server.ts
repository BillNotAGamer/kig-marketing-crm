import "server-only";
import { getDb } from "@/db";
import { getServerEnv } from "@/lib/env";
import { brandService } from "./service";
import { brandsHttp } from "./http";

export function getBrands() {
  return brandService(getDb(), getServerEnv());
}

export function handleBrands(request: Request) {
  const env = getServerEnv();
  return brandsHttp(request, getBrands(), env.BETTER_AUTH_URL);
}
