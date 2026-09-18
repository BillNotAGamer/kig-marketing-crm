import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { authFixtures } from "../test/auth-fixtures";
import { createAuth } from "../lib/auth/factory";
import { taskService } from "../lib/tasks/service";
import { assetService } from "../lib/assets/service";
import { assetsHttp } from "../lib/assets/http";
import { MockDriveClient } from "../lib/drive/client";
import { taskAsset } from "./schema";

let fixture: Awaited<ReturnType<typeof authFixtures>>;
let tasks: ReturnType<typeof taskService>;
let assets: ReturnType<typeof assetService>;
let mockDrive: MockDriveClient;
let head: Headers;
let deputy: Headers;
let employee: Headers;
let employeeB: Headers;

beforeAll(async () => {
  fixture = await authFixtures("phase5");
  tasks = taskService(fixture.db, fixture.env);
  mockDrive = new MockDriveClient({
    "file-doc-1": {
      name: "Campaign Brief.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      webViewLink: "https://drive.google.com/file/d/file-doc-1/view",
    },
    "file-sheet-1": {
      name: "Q3 Budget.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      webViewLink: "https://drive.google.com/file/d/file-sheet-1/view",
    },
    "file-image-1": {
      name: "Hero Banner.png",
      mimeType: "image/png",
      webViewLink: "https://drive.google.com/file/d/file-image-1/view",
    },
    "file-video-1": {
      name: "Promo Video.mp4",
      mimeType: "video/mp4",
      webViewLink: "https://drive.google.com/file/d/file-video-1/view",
    },
    "file-pdf-1": {
      name: "Contract.pdf",
      mimeType: "application/pdf",
      webViewLink: "https://drive.google.com/file/d/file-pdf-1/view",
    },
    "file-trashed-1": {
      name: "Trashed.pdf",
      mimeType: "application/pdf",
      trashed: true,
    },
    "file-folder-1": {
      name: "Assets Folder",
      mimeType: "application/vnd.google-apps.folder",
    },
  });

  assets = assetService(fixture.db, fixture.env, mockDrive);

  const login = async (email: string) => {
    const response = await createAuth(fixture.db, fixture.env).api.signInEmail({
      body: { email, password: fixture.password },
      asResponse: true,
    });
    expect(response.status).toBe(200);
    return new Headers({
      cookie: response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; "),
    });
  };

  head = await login(fixture.head.email);
  deputy = await login(fixture.deputy.email);
  employee = await login(fixture.employee.email);
  employeeB = await login(fixture.employeeB.email);
});

afterAll(async () => {
  if (fixture) await fixture.cleanup();
});

async function createTask(assignee = fixture.employee.id) {
  return tasks.createTask(head, {
    title: `Asset Task ${randomUUID()}`,
    assignedToId: assignee,
    assignedDate: "2026-09-19",
  });
}

it("proves deliverable attachment authorization across roles and lifecycle states", async () => {
  const empTask = await createTask(fixture.employee.id);
  const depTask = await createTask(fixture.deputy.id);

  // 1. Employee attaches to own OPEN task
  const empAsset = await assets.addAsset(employee, empTask.id, {
    sourceUrl: "https://drive.google.com/file/d/file-doc-1/view",
  });
  expect(empAsset).toMatchObject({
    provider: "GOOGLE_DRIVE",
    providerFileId: "file-doc-1",
    fileName: "Campaign Brief.docx",
    assetType: "DOCUMENT",
    canRemove: true,
  });

  // 2. Deputy attaches to own OPEN task
  const depAsset = await assets.addAsset(deputy, depTask.id, {
    sourceUrl: "https://drive.google.com/file/d/file-sheet-1/view",
  });
  expect(depAsset).toMatchObject({
    provider: "GOOGLE_DRIVE",
    providerFileId: "file-sheet-1",
    fileName: "Q3 Budget.xlsx",
    assetType: "SPREADSHEET",
    canRemove: true,
  });

  // 3. Employee cannot attach to another user's task
  await expect(
    assets.addAsset(employee, depTask.id, {
      sourceUrl: "https://drive.google.com/file/d/file-image-1/view",
    }),
  ).rejects.toMatchObject({ status: 403 });

  // 4. Deputy cannot attach to employee's task
  await expect(
    assets.addAsset(deputy, empTask.id, {
      sourceUrl: "https://drive.google.com/file/d/file-image-1/view",
    }),
  ).rejects.toMatchObject({ status: 403 });

  // 5. HEAD attaches to employee's task
  const headAsset = await assets.addAsset(head, empTask.id, {
    sourceUrl: "https://drive.google.com/file/d/file-image-1/view",
  });
  expect(headAsset).toMatchObject({
    provider: "GOOGLE_DRIVE",
    providerFileId: "file-image-1",
    fileName: "Hero Banner.png",
    assetType: "IMAGE",
    canRemove: true,
  });

  // 6. Test on CANCELLED task
  const cancelled = await createTask(fixture.employee.id);
  await tasks.cancelTask(head, cancelled.id, {});

  // Employee cannot attach to CANCELLED task
  await expect(
    assets.addAsset(employee, cancelled.id, {
      sourceUrl: "https://drive.google.com/file/d/file-pdf-1/view",
    }),
  ).rejects.toMatchObject({ status: 403 });

  // HEAD can administratively attach to CANCELLED task
  const headCancelledAsset = await assets.addAsset(head, cancelled.id, {
    sourceUrl: "https://drive.google.com/file/d/file-pdf-1/view",
  });
  expect(headCancelledAsset.providerFileId).toBe("file-pdf-1");
});

it("enforces duplicate active asset rejection (409 Conflict) and reattachment after soft removal", async () => {
  const testTask = await createTask(fixture.employee.id);

  // Initial attach succeeds
  const initial = await assets.addAsset(employee, testTask.id, {
    sourceUrl: "https://drive.google.com/file/d/file-doc-1/view",
  });
  expect(initial.providerFileId).toBe("file-doc-1");

  // Attempt duplicate attach while active -> 409 Conflict
  await expect(
    assets.addAsset(employee, testTask.id, {
      sourceUrl: "https://drive.google.com/file/d/file-doc-1/view",
    }),
  ).rejects.toMatchObject({ status: 409 });

  // Soft-remove the asset
  await assets.removeAsset(employee, testTask.id, initial.id, {});

  // After soft removal, reattachment of the same file succeeds
  const reattached = await assets.addAsset(employee, testTask.id, {
    sourceUrl: "https://drive.google.com/file/d/file-doc-1/view",
  });
  expect(reattached.providerFileId).toBe("file-doc-1");
  expect(reattached.id).not.toBe(initial.id);
});

it("enforces asset read scoping and hides soft-deleted assets and soft-deleted tasks", async () => {
  const ownTask = await createTask(fixture.employee.id);
  const foreignTask = await createTask(fixture.employeeB.id);

  await assets.addAsset(employee, ownTask.id, {
    sourceUrl: "https://drive.google.com/file/d/file-doc-1/view",
  });
  await assets.addAsset(employeeB, foreignTask.id, {
    sourceUrl: "https://drive.google.com/file/d/file-sheet-1/view",
  });

  // Employee reads own task deliverables -> sees 1
  const empOwn = await assets.getTaskAssets(employee, ownTask.id);
  expect(empOwn.assets).toHaveLength(1);
  expect(empOwn.assets[0].fileName).toBe("Campaign Brief.docx");
  expect(empOwn.canAdd).toBe(true);

  // Employee reading foreign task deliverables -> 404
  await expect(
    assets.getTaskAssets(employee, foreignTask.id),
  ).rejects.toMatchObject({ status: 404 });

  // HEAD and DEPUTY read team task deliverables -> see foreign task deliverables
  const headView = await assets.getTaskAssets(head, foreignTask.id);
  expect(headView.assets).toHaveLength(1);
  expect(headView.canAdd).toBe(true);

  const deputyView = await assets.getTaskAssets(deputy, foreignTask.id);
  expect(deputyView.assets).toHaveLength(1);
  expect(deputyView.canAdd).toBe(false); // DEPUTY cannot add to employee task

  // Soft-delete task hides deliverables from all actors
  await tasks.softDeleteTask(head, foreignTask.id, {});
  await expect(
    assets.getTaskAssets(head, foreignTask.id),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    assets.getTaskAssets(employeeB, foreignTask.id),
  ).rejects.toMatchObject({ status: 404 });
});

it("proves deliverable removal authorization and preserves Google Drive source content", async () => {
  const testTask = await createTask(fixture.employee.id);

  const empAsset = await assets.addAsset(employee, testTask.id, {
    sourceUrl: "https://drive.google.com/file/d/file-doc-1/view",
  });
  const headAsset = await assets.addAsset(head, testTask.id, {
    sourceUrl: "https://drive.google.com/file/d/file-sheet-1/view",
  });

  // 1. Employee cannot remove asset added by HEAD
  await expect(
    assets.removeAsset(employee, testTask.id, headAsset.id, {}),
  ).rejects.toMatchObject({ status: 403 });

  // 2. Employee can remove own asset
  await assets.removeAsset(employee, testTask.id, empAsset.id, {});

  // Verify soft deletion in DB
  const [removedRow] = await fixture.db
    .select()
    .from(taskAsset)
    .where(eq(taskAsset.id, empAsset.id));

  expect(removedRow.deletedAt).not.toBeNull();
  expect(removedRow.deletedById).toBe(fixture.employee.id);

  // 3. HEAD can remove any active asset
  await assets.removeAsset(head, testTask.id, headAsset.id, {});

  const [headRemovedRow] = await fixture.db
    .select()
    .from(taskAsset)
    .where(eq(taskAsset.id, headAsset.id));

  expect(headRemovedRow.deletedAt).not.toBeNull();
  expect(headRemovedRow.deletedById).toBe(fixture.head.id);

  // Verify mockDrive file was NOT deleted or altered
  const originalFile = await mockDrive.getFileMetadata("file-doc-1");
  expect(originalFile.name).toBe("Campaign Brief.docx");
  expect(originalFile.trashed).toBe(false);
});

it("rejects trashed files and folders with controlled 400 errors", async () => {
  const testTask = await createTask(fixture.employee.id);

  // Trashed file
  await expect(
    assets.addAsset(employee, testTask.id, {
      sourceUrl: "https://drive.google.com/file/d/file-trashed-1/view",
    }),
  ).rejects.toMatchObject({ status: 400 });

  // Folder
  await expect(
    assets.addAsset(employee, testTask.id, {
      sourceUrl: "https://drive.google.com/drive/folders/file-folder-1",
    }),
  ).rejects.toMatchObject({ status: 400 });
});

it("verifies audit logging and atomic rollback on audit failure", async () => {
  const rollback = new Error("rollback asset test transaction");

  await expect(
    fixture.db.transaction(async (tx) => {
      const localTasks = taskService(tx, fixture.env);
      const localAssets = assetService(tx, fixture.env, mockDrive);

      const created = await localTasks.createTask(head, {
        title: `Rollback Asset ${randomUUID()}`,
        assignedToId: fixture.employee.id,
        assignedDate: "2026-09-19",
      });

      // Instrument audit trigger rejection
      await tx.execute(
        sql`CREATE FUNCTION pg_temp.kig_phase5_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action=current_setting('kig.phase5_fail_audit',true) THEN RAISE EXCEPTION 'Injected asset audit rejection' USING ERRCODE='23514'; END IF; RETURN NEW; END $$`,
      );
      await tx.execute(
        sql`CREATE TRIGGER kig_phase5_fail_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION pg_temp.kig_phase5_fail_audit()`,
      );

      // 1. Rollback on ADD_TASK_ASSET audit failure
      await tx.execute(
        sql`SELECT set_config('kig.phase5_fail_audit','ADD_TASK_ASSET',true)`,
      );

      await expect(
        localAssets.addAsset(employee, created.id, {
          sourceUrl: "https://drive.google.com/file/d/file-doc-1/view",
        }),
      ).rejects.toBeDefined();

      const assetsAfterFailedAdd = await tx
        .select()
        .from(taskAsset)
        .where(eq(taskAsset.taskId, created.id));
      expect(assetsAfterFailedAdd).toHaveLength(0);

      // Clear trigger config and add asset normally
      await tx.execute(sql`SELECT set_config('kig.phase5_fail_audit','',true)`);
      const added = await localAssets.addAsset(employee, created.id, {
        sourceUrl: "https://drive.google.com/file/d/file-doc-1/view",
      });
      expect(added.id).toBeDefined();

      // 2. Rollback on REMOVE_TASK_ASSET audit failure
      await tx.execute(
        sql`SELECT set_config('kig.phase5_fail_audit','REMOVE_TASK_ASSET',true)`,
      );

      await expect(
        localAssets.removeAsset(employee, created.id, added.id, {}),
      ).rejects.toBeDefined();

      const [assetAfterFailedRemove] = await tx
        .select()
        .from(taskAsset)
        .where(eq(taskAsset.id, added.id));
      expect(assetAfterFailedRemove.deletedAt).toBeNull();

      throw rollback;
    }),
  ).rejects.toBe(rollback);
});

it("HTTP boundary: enforces exact origin, strict payload, and controlled error responses", async () => {
  const testTask = await createTask(fixture.employee.id);

  const boundary = async (
    path: string,
    method: string,
    body: unknown,
    headers: Headers,
    origin = fixture.env.BETTER_AUTH_URL,
  ) => {
    const reqHeaders = new Headers(headers);
    reqHeaders.set("origin", origin);
    reqHeaders.set("Content-Type", "application/json");

    const req = new Request(`http://127.0.0.1${path}`, {
      method,
      headers: reqHeaders,
      body: method !== "GET" ? JSON.stringify(body) : undefined,
    });

    const isRemove = path.endsWith("/remove");
    const parts = path.split("/").filter(Boolean);
    const assetId = isRemove ? parts[4] : undefined;

    return assetsHttp(
      req,
      assets,
      fixture.env.BETTER_AUTH_URL,
      testTask.id,
      assetId,
      isRemove,
    );
  };

  // 1. Cross-origin mutation rejected with 403
  const badOrigin = await boundary(
    `/api/tasks/${testTask.id}/assets`,
    "POST",
    { sourceUrl: "https://drive.google.com/file/d/file-doc-1/view" },
    employee,
    "https://evil.attacker.example",
  );
  expect(badOrigin.status).toBe(403);

  // 2. Invalid Drive URL rejected with 400
  const badUrl = await boundary(
    `/api/tasks/${testTask.id}/assets`,
    "POST",
    { sourceUrl: "https://attacker.example/file/d/file-doc-1" },
    employee,
  );
  expect(badUrl.status).toBe(400);

  // 3. Extraneous payload fields rejected with 400
  const extraFields = await boundary(
    `/api/tasks/${testTask.id}/assets`,
    "POST",
    {
      sourceUrl: "https://drive.google.com/file/d/file-doc-1/view",
      assetType: "IMAGE",
      createdById: fixture.head.id,
    },
    employee,
  );
  expect(extraFields.status).toBe(400);

  // 4. Successful POST returns 201
  const goodPost = await boundary(
    `/api/tasks/${testTask.id}/assets`,
    "POST",
    { sourceUrl: "https://drive.google.com/file/d/file-doc-1/view" },
    employee,
  );
  expect(goodPost.status).toBe(201);
  const goodData = await goodPost.json();
  expect(goodData.fileName).toBe("Campaign Brief.docx");

  // 5. Successful GET returns 200 with no-store
  const getRes = await boundary(
    `/api/tasks/${testTask.id}/assets`,
    "GET",
    undefined,
    employee,
  );
  expect(getRes.status).toBe(200);
  expect(getRes.headers.get("Cache-Control")).toBe("no-store");
  const getData = await getRes.json();
  expect(getData.assets).toHaveLength(1);
});
