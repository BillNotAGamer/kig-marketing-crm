import { describe, expect, it } from "vitest";
import type { Actor } from "../auth/session-core";
import {
  addAssetSchema,
  canAddAsset,
  canReadAssets,
  canRemoveAsset,
  removeAssetSchema,
} from "./model";

const headActor: Actor = {
  id: "head-uuid-1",
  role: "HEAD",
  name: "Department Head",
  email: "head@kig.local",
};

const deputyActor: Actor = {
  id: "deputy-uuid-2",
  role: "DEPUTY",
  name: "Deputy Lead",
  email: "deputy@kig.local",
};

const employeeActorA: Actor = {
  id: "employee-uuid-3",
  role: "EMPLOYEE",
  name: "Marketing Employee A",
  email: "employee.a@kig.local",
};

const employeeActorB: Actor = {
  id: "employee-uuid-4",
  role: "EMPLOYEE",
  name: "Marketing Employee B",
  email: "employee.b@kig.local",
};

describe("Task Asset attachment authorization (canAddAsset)", () => {
  it("allows HEAD to attach deliverable to OPEN, COMPLETED, or CANCELLED tasks", () => {
    expect(
      canAddAsset(headActor, {
        assignedToId: employeeActorA.id,
        status: "OPEN",
        deletedAt: null,
      }),
    ).toBe(true);

    expect(
      canAddAsset(headActor, {
        assignedToId: employeeActorA.id,
        status: "COMPLETED",
        deletedAt: null,
      }),
    ).toBe(true);

    expect(
      canAddAsset(headActor, {
        assignedToId: employeeActorA.id,
        status: "CANCELLED",
        deletedAt: null,
      }),
    ).toBe(true);
  });

  it("denies HEAD from attaching deliverable to soft-deleted task", () => {
    expect(
      canAddAsset(headActor, {
        assignedToId: employeeActorA.id,
        status: "OPEN",
        deletedAt: new Date(),
      }),
    ).toBe(false);
  });

  it("allows DEPUTY and EMPLOYEE to attach only to their own current OPEN task", () => {
    expect(
      canAddAsset(employeeActorA, {
        assignedToId: employeeActorA.id,
        status: "OPEN",
        deletedAt: null,
      }),
    ).toBe(true);

    expect(
      canAddAsset(deputyActor, {
        assignedToId: deputyActor.id,
        status: "OPEN",
        deletedAt: null,
      }),
    ).toBe(true);
  });

  it("denies EMPLOYEE and DEPUTY from attaching to another user's task", () => {
    expect(
      canAddAsset(employeeActorA, {
        assignedToId: employeeActorB.id,
        status: "OPEN",
        deletedAt: null,
      }),
    ).toBe(false);

    expect(
      canAddAsset(deputyActor, {
        assignedToId: employeeActorA.id,
        status: "OPEN",
        deletedAt: null,
      }),
    ).toBe(false);
  });

  it("denies EMPLOYEE and DEPUTY from attaching to their own COMPLETED or CANCELLED task", () => {
    expect(
      canAddAsset(employeeActorA, {
        assignedToId: employeeActorA.id,
        status: "COMPLETED",
        deletedAt: null,
      }),
    ).toBe(false);

    expect(
      canAddAsset(employeeActorA, {
        assignedToId: employeeActorA.id,
        status: "CANCELLED",
        deletedAt: null,
      }),
    ).toBe(false);

    expect(
      canAddAsset(deputyActor, {
        assignedToId: deputyActor.id,
        status: "COMPLETED",
        deletedAt: null,
      }),
    ).toBe(false);
  });
});

describe("Task Asset removal authorization (canRemoveAsset)", () => {
  it("allows HEAD to remove active deliverable on any non-deleted task", () => {
    expect(
      canRemoveAsset(
        headActor,
        {
          assignedToId: employeeActorA.id,
          status: "OPEN",
          deletedAt: null,
        },
        {
          createdById: employeeActorA.id,
          deletedAt: null,
        },
      ),
    ).toBe(true);

    expect(
      canRemoveAsset(
        headActor,
        {
          assignedToId: employeeActorA.id,
          status: "COMPLETED",
          deletedAt: null,
        },
        {
          createdById: employeeActorA.id,
          deletedAt: null,
        },
      ),
    ).toBe(true);
  });

  it("denies HEAD from removing already soft-deleted asset or on soft-deleted task", () => {
    expect(
      canRemoveAsset(
        headActor,
        {
          assignedToId: employeeActorA.id,
          status: "OPEN",
          deletedAt: new Date(),
        },
        {
          createdById: employeeActorA.id,
          deletedAt: null,
        },
      ),
    ).toBe(false);

    expect(
      canRemoveAsset(
        headActor,
        {
          assignedToId: employeeActorA.id,
          status: "OPEN",
          deletedAt: null,
        },
        {
          createdById: employeeActorA.id,
          deletedAt: new Date(),
        },
      ),
    ).toBe(false);
  });

  it("allows EMPLOYEE to remove only their own deliverable on their own OPEN task", () => {
    expect(
      canRemoveAsset(
        employeeActorA,
        {
          assignedToId: employeeActorA.id,
          status: "OPEN",
          deletedAt: null,
        },
        {
          createdById: employeeActorA.id,
          deletedAt: null,
        },
      ),
    ).toBe(true);
  });

  it("denies EMPLOYEE from removing deliverable created by HEAD", () => {
    expect(
      canRemoveAsset(
        employeeActorA,
        {
          assignedToId: employeeActorA.id,
          status: "OPEN",
          deletedAt: null,
        },
        {
          createdById: headActor.id,
          deletedAt: null,
        },
      ),
    ).toBe(false);
  });

  it("denies EMPLOYEE from removing deliverable if task is COMPLETED or CANCELLED", () => {
    expect(
      canRemoveAsset(
        employeeActorA,
        {
          assignedToId: employeeActorA.id,
          status: "COMPLETED",
          deletedAt: null,
        },
        {
          createdById: employeeActorA.id,
          deletedAt: null,
        },
      ),
    ).toBe(false);

    expect(
      canRemoveAsset(
        employeeActorA,
        {
          assignedToId: employeeActorA.id,
          status: "CANCELLED",
          deletedAt: null,
        },
        {
          createdById: employeeActorA.id,
          deletedAt: null,
        },
      ),
    ).toBe(false);
  });

  it("denies EMPLOYEE from removing deliverable if task was reassigned to another user", () => {
    expect(
      canRemoveAsset(
        employeeActorA,
        {
          assignedToId: employeeActorB.id,
          status: "OPEN",
          deletedAt: null,
        },
        {
          createdById: employeeActorA.id,
          deletedAt: null,
        },
      ),
    ).toBe(false);
  });
});

describe("Task Asset read authorization (canReadAssets)", () => {
  it("allows all active roles (ADMIN, HEAD, DEPUTY, EMPLOYEE) to read deliverables of any non-deleted task", () => {
    const adminActor: Actor = {
      id: "admin-uuid-0",
      role: "ADMIN",
      name: "Admin User",
      email: "admin@kig.local",
    };

    expect(
      canReadAssets(adminActor, {
        assignedToId: employeeActorA.id,
        deletedAt: null,
      }),
    ).toBe(true);

    expect(
      canReadAssets(headActor, {
        assignedToId: employeeActorA.id,
        deletedAt: null,
      }),
    ).toBe(true);

    expect(
      canReadAssets(deputyActor, {
        assignedToId: employeeActorA.id,
        deletedAt: null,
      }),
    ).toBe(true);

    expect(
      canReadAssets(employeeActorA, {
        assignedToId: employeeActorA.id,
        deletedAt: null,
      }),
    ).toBe(true);

    // Foreign task: EMPLOYEE can view deliverables!
    expect(
      canReadAssets(employeeActorA, {
        assignedToId: employeeActorB.id,
        deletedAt: null,
      }),
    ).toBe(true);
  });

  it("denies all roles from reading deliverables of soft-deleted task", () => {
    expect(
      canReadAssets(headActor, {
        assignedToId: employeeActorA.id,
        deletedAt: new Date(),
      }),
    ).toBe(false);

    expect(
      canReadAssets(deputyActor, {
        assignedToId: employeeActorA.id,
        deletedAt: new Date(),
      }),
    ).toBe(false);

    expect(
      canReadAssets(employeeActorA, {
        assignedToId: employeeActorA.id,
        deletedAt: new Date(),
      }),
    ).toBe(false);

    expect(
      canReadAssets(employeeActorA, {
        assignedToId: employeeActorB.id,
        deletedAt: new Date(),
      }),
    ).toBe(false);
  });
});

describe("Task Asset strict schema validation", () => {
  it("validates addAssetSchema with clean sourceUrl", () => {
    const valid = addAssetSchema.safeParse({
      sourceUrl:
        "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view",
    });
    expect(valid.success).toBe(true);
  });

  it("rejects privileged or extraneous fields in addAssetSchema", () => {
    const malicious = addAssetSchema.safeParse({
      sourceUrl:
        "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view",
      provider: "GOOGLE_DRIVE",
      providerFileId: "forged-id",
      createdById: headActor.id,
      assetType: "IMAGE",
      deletedAt: null,
    });
    expect(malicious.success).toBe(false);
  });

  it("rejects non-empty payloads in removeAssetSchema", () => {
    expect(removeAssetSchema.safeParse({}).success).toBe(true);
    expect(removeAssetSchema.safeParse({ force: true }).success).toBe(false);
  });
});
