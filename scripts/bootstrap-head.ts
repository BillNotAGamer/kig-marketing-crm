import { createDatabase } from "../src/db/connection";
import { parseServerEnv } from "../src/lib/env-schema";
import { bootstrapHead } from "../src/lib/users/bootstrap";
import { requireDevelopmentDatabase } from "./database-env";

async function main() {
  const url = requireDevelopmentDatabase();
  const db = createDatabase(url);
  try {
    await bootstrapHead(db, parseServerEnv(process.env), {
      name: process.env.KIG_BOOTSTRAP_HEAD_NAME,
      email: process.env.KIG_BOOTSTRAP_HEAD_EMAIL,
      password: process.env.KIG_BOOTSTRAP_HEAD_PASSWORD,
    });
    console.log(
      "Initial HEAD created with audited bootstrap evidence. Credentials withheld.",
    );
  } finally {
    await db.$client.end();
  }
}
main().catch(() => {
  console.error(
    "Bootstrap refused or failed. Privately verify authorization, required inputs, password policy, duplicate identity and existing ACTIVE HEAD. No credentials printed.",
  );
  process.exitCode = 1;
});
