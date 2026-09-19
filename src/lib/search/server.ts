import "server-only";
import { getDb } from "@/db";
import { getServerEnv } from "@/lib/env";
import { searchService } from "./service";

export function getSearch() {
  return searchService(getDb(), getServerEnv());
}
