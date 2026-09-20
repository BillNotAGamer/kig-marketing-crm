import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  requireAdminPromotionDatabase,
  safeDatabaseError,
} from "./database-env";
import { createScriptDatabase } from "./lib/database";
import { checkPromotionReadiness, executePromotion } from "./lib/promote";

async function main() {
  const isCheck =
    process.argv.includes("--check") || process.argv.includes("--dry-run");

  const url = requireAdminPromotionDatabase({ allowReadOnlyCheck: isCheck });
  const dbHelper = createScriptDatabase(url);

  try {
    if (isCheck) {
      console.log("=== First ADMIN Promotion CLI: Read-Only Check ===");
      console.log("Mode: --check (DRY RUN - ZERO mutations will be performed)");
      console.log(
        "Runtime: Standalone Node / tsx (server-only bypassed safely)",
      );
      console.log("Environment: Authorized production database validated");

      const targetEmail = process.env.KIG_FIRST_ADMIN_EMAIL?.trim();
      const result = await checkPromotionReadiness(dbHelper.db, targetEmail);

      console.log("\n--- Production Counts (Sanitized) ---");
      console.log(`Total users: ${result.totalUsers}`);
      console.log(`Active ADMIN: ${result.activeAdmins}`);
      console.log(`Active HEAD: ${result.activeHeads}`);
      console.log(`Active DEPUTY: ${result.activeDeputies}`);
      console.log(`Active EMPLOYEE: ${result.activeEmployees}`);
      console.log(`Banned/Inactive: ${result.bannedUsers}`);

      if (targetEmail) {
        console.log("\n--- Target Account Verification ---");
        if (!result.targetUser) {
          console.log("Target user: NOT FOUND with specified email");
        } else if (result.targetUser.banned) {
          console.log(
            "Target user: INACTIVE/BANNED (ineligible for promotion)",
          );
        } else if (result.targetUser.role !== "HEAD") {
          console.log(
            `Target user: ROLE is '${result.targetUser.role}' (ineligible, must be HEAD)`,
          );
        } else {
          console.log("Target user: ELIGIBLE active HEAD account confirmed");
        }
      }

      console.log("\n--- Readiness Verdict ---");
      if (result.activeAdmins > 0) {
        console.log(
          `STATUS: INELIGIBLE - Active ADMIN already exists (count: ${result.activeAdmins}).`,
        );
      } else if (result.activeHeads < 1) {
        console.log("STATUS: INELIGIBLE - No active HEAD found to promote.");
      } else {
        console.log(
          "STATUS: READY FOR FIRST ADMIN PROMOTION (0 ADMINs, active HEAD exists)",
        );
      }
      console.log("\nCheck complete: ZERO writes, ZERO mutations performed.");
      return;
    }

    // Real promotion mode
    let targetEmail = process.env.KIG_FIRST_ADMIN_EMAIL?.trim();

    if (!targetEmail) {
      if (input.isTTY) {
        const rl = readline.createInterface({ input, output });
        try {
          const answer = await rl.question(
            "Enter email address of existing active HEAD to promote to ADMIN: ",
          );
          targetEmail = answer.trim();
        } finally {
          rl.close();
        }
      } else {
        console.error(
          "Refusing execution: Target email not provided. Set KIG_FIRST_ADMIN_EMAIL environment variable.",
        );
        process.exit(1);
      }
    }

    if (!targetEmail) {
      console.error("Refusing execution: Target email is empty.");
      process.exit(1);
    }

    console.log("Starting first ADMIN promotion transaction...");
    await executePromotion(dbHelper.db, targetEmail);

    console.log(
      "Promotion successful! Exactly 1 active ADMIN is now configured.",
    );
    console.log(
      "Target user must re-authenticate to receive new ADMIN session.",
    );
  } finally {
    await dbHelper.close();
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : safeDatabaseError(error);
  console.error(`Promotion refused or failed: ${message}`);
  process.exit(1);
});
