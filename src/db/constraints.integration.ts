import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { expect, it } from "vitest";
import { requireDevelopmentDatabase } from "../../scripts/database-env";
import { inspectDatabase } from "./inspect";

it("verifies PostgreSQL catalogs and constraints with rolled-back fixtures", async () => {
  const client = postgres(requireDevelopmentDatabase(), {
    max: 1,
    prepare: false,
  });
  const rollback = new Error("rollback test fixtures");
  try {
    expect((await inspectDatabase(client)).applicationTables).toBe(5);
    await expect(
      client.begin(async (tx) => {
        const userId = randomUUID();
        const taskId = randomUUID();
        await tx`INSERT INTO "user" (id,name,email) VALUES (${userId},'Constraint fixture',${userId + "@example.invalid"})`;
        await tx`INSERT INTO task (id,title,assigned_date,created_by_id,assigned_to_id) VALUES (${taskId},'Constraint fixture','2026-09-18',${userId},${userId})`;
        async function rejects(statement: string, code: string) {
          await expect(
            tx.savepoint(async (sp) => {
              await sp.unsafe(statement);
            }),
          ).rejects.toMatchObject({ code });
        }
        // Statements are internal test constants, never user input.
        for (const assignment of [
          "title='   '",
          "due_date='2026-09-17'",
          "completed_at=now()",
          "cancelled_at=now()",
          "status='COMPLETED'",
          "status='COMPLETED',completed_at=now(),cancelled_at=now()",
          "status='CANCELLED'",
          "status='CANCELLED',cancelled_at=now(),completed_at=now()",
          "deleted_at=now()",
          "deleted_by_id='" + userId + "'",
        ])
          await rejects(
            "UPDATE task SET " + assignment + " WHERE id='" + taskId + "'",
            "23514",
          );
        const daily =
          "INSERT INTO task_daily_update(task_id,user_id,report_date,status,reason) VALUES ('" +
          taskId +
          "','" +
          userId +
          "','2026-09-18',";
        for (const reason of ["NULL", "'   '"])
          await rejects(daily + "'NOT_COMPLETED'," + reason + ")", "23514");
        await rejects(daily + "'COMPLETED','unexpected')", "23514");
        await tx`INSERT INTO task_daily_update(task_id,user_id,report_date,status) VALUES (${taskId},${userId},'2026-09-18','COMPLETED')`;
        await rejects(daily + "'COMPLETED',NULL)", "23505");
        await rejects(
          "UPDATE task_daily_update SET corrected_at=now() WHERE task_id='" +
            taskId +
            "'",
          "23514",
        );
        const asset =
          "INSERT INTO task_asset(task_id,created_by_id,provider,provider_file_id,source_url,asset_type) VALUES ('" +
          taskId +
          "','" +
          userId +
          "','GOOGLE_DRIVE','fixture-file','https://drive.google.com/file/d/fixture-file/view','OTHER')";
        await rejects(asset.replace("'fixture-file'", "'   '"), "23514");
        await rejects(
          asset.replace(
            "'https://drive.google.com/file/d/fixture-file/view'",
            "'   '",
          ),
          "23514",
        );
        await tx.unsafe(asset);
        await rejects(asset, "23505");
        await rejects(
          "UPDATE task_asset SET deleted_at=now() WHERE task_id='" +
            taskId +
            "'",
          "23514",
        );
        await tx`UPDATE task_asset SET deleted_at=now(),deleted_by_id=${userId} WHERE task_id=${taskId}`;
        await tx.unsafe(asset);
        await rejects("DELETE FROM task WHERE id='" + taskId + "'", "23001");
        await rejects('DELETE FROM "user" WHERE id=\'' + userId + "'", "23001");
        const [date] =
          await tx`SELECT assigned_date::text AS value FROM task WHERE id=${taskId}`;
        expect(date.value).toBe("2026-09-18");
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  } finally {
    await client.end();
  }
});
