// @vitest-environment node
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { normalizeBrandName, isDuplicateBrand } from "./normalization";
import { createBrandSchema } from "./validation";
import {
  canCreateBrand,
  canReadBrands,
  requireCreateBrandPermission,
} from "./policy";
import { brandsHttp } from "./http";
import type { TaskDTO } from "../tasks/types";
import { AccessError } from "../auth/permissions";
import type { BrandDTO } from "./types";

describe("Brand Normalization", () => {
  it("normalizes casing and collapses whitespace", () => {
    expect(normalizeBrandName("GOGI MARU")).toBe("gogi maru");
    expect(normalizeBrandName("gogi maru")).toBe("gogi maru");
    expect(normalizeBrandName("  GOGI   MARU  ")).toBe("gogi maru");
  });

  it("handles Vietnamese diacritics correctly", () => {
    expect(normalizeBrandName("Truyền Thuyết Champong")).toBe(
      "truyền thuyết champong",
    );
    expect(normalizeBrandName("  TRUYỀN   THUYẾT   CHAMPONG  ")).toBe(
      "truyền thuyết champong",
    );
    expect(normalizeBrandName("SEOUL GUKBAP")).toBe("seoul gukbap");
    expect(normalizeBrandName("KBB COOK")).toBe("kbb cook");
  });

  it("detects duplicates under normalization", () => {
    const existing = [
      "Truyền Thuyết Champong",
      "GOGI MARU",
      "KBB COOK",
      "SEOUL GUKBAP",
    ];
    expect(isDuplicateBrand("gogi maru", existing)).toBe(true);
    expect(isDuplicateBrand("  GOGI   MARU  ", existing)).toBe(true);
    expect(isDuplicateBrand("GOGI MARU", existing)).toBe(true);
    expect(isDuplicateBrand("kbb cook", existing)).toBe(true);
    expect(isDuplicateBrand("NEW BRAND", existing)).toBe(false);
  });
});

describe("Brand Validation Schema", () => {
  it("rejects blank or whitespace-only name", () => {
    expect(createBrandSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createBrandSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects overlong name exceeding 100 characters", () => {
    expect(createBrandSchema.safeParse({ name: "a".repeat(101) }).success).toBe(
      false,
    );
    expect(createBrandSchema.safeParse({ name: "a".repeat(100) }).success).toBe(
      true,
    );
  });

  it("enforces strict schema rejecting extra/unknown fields", () => {
    expect(
      createBrandSchema.safeParse({
        name: "Test Brand",
        extraField: "hack",
      }).success,
    ).toBe(false);
    expect(
      createBrandSchema.safeParse({
        name: "Test Brand",
        id: randomUUID(),
      }).success,
    ).toBe(false);
  });

  it("accepts valid brand names", () => {
    const result = createBrandSchema.safeParse({ name: "GOGI MARU" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("GOGI MARU");
    }
  });
});

describe("Brand Role Policy & Permissions", () => {
  it("allows HEAD to create brands", () => {
    expect(canCreateBrand("HEAD")).toBe(true);
    expect(() =>
      requireCreateBrandPermission({
        id: randomUUID(),
        role: "HEAD",
        name: "Head User",
        email: "head@example.invalid",
      }),
    ).not.toThrow();
  });

  it("allows DEPUTY to create brands", () => {
    expect(canCreateBrand("DEPUTY")).toBe(true);
    expect(() =>
      requireCreateBrandPermission({
        id: randomUUID(),
        role: "DEPUTY",
        name: "Deputy User",
        email: "deputy@example.invalid",
      }),
    ).not.toThrow();
  });

  it("forbids EMPLOYEE from creating brands with 403 AccessError", () => {
    expect(canCreateBrand("EMPLOYEE")).toBe(false);
    expect(() =>
      requireCreateBrandPermission({
        id: randomUUID(),
        role: "EMPLOYEE",
        name: "Employee User",
        email: "employee@example.invalid",
      }),
    ).toThrow(AccessError);

    try {
      requireCreateBrandPermission({
        id: randomUUID(),
        role: "EMPLOYEE",
        name: "Employee User",
        email: "employee@example.invalid",
      });
    } catch (err) {
      expect(err instanceof AccessError).toBe(true);
      if (err instanceof AccessError) {
        expect(err.status).toBe(403);
      }
    }
  });

  it("allows all authenticated roles to read brands", () => {
    expect(canReadBrands("HEAD")).toBe(true);
    expect(canReadBrands("DEPUTY")).toBe(true);
    expect(canReadBrands("EMPLOYEE")).toBe(true);
  });
});

describe("Brand HTTP Security", () => {
  const origin = "http://localhost:3000";
  const mockService: Parameters<typeof brandsHttp>[1] = {
    listBrands: async (): Promise<BrandDTO[]> => [
      {
        id: randomUUID(),
        name: "GOGI MARU",
        normalizedName: "gogi maru",
        createdAt: new Date().toISOString(),
      },
    ],
    createBrand: async (): Promise<BrandDTO> => ({
      id: randomUUID(),
      name: "New Brand",
      normalizedName: "new brand",
      createdAt: new Date().toISOString(),
    }),
  };

  it("enforces origin verification on POST", async () => {
    const request = new Request("http://localhost:3000/api/brands", {
      method: "POST",
      headers: {
        Origin: "http://attacker.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Evil Brand" }),
    });
    const res = await brandsHttp(request, mockService, origin);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Invalid origin.");
  });

  it("enforces application/json Content-Type on POST", async () => {
    const request = new Request("http://localhost:3000/api/brands", {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "text/plain",
      },
      body: "name=SomeBrand",
    });
    const res = await brandsHttp(request, mockService, origin);
    expect(res.status).toBe(415);
    const data = await res.json();
    expect(data.error).toBe("JSON content type required.");
  });

  it("rejects disallowed HTTP methods with 405", async () => {
    for (const method of ["PUT", "DELETE", "PATCH"]) {
      const request = new Request("http://localhost:3000/api/brands", {
        method,
        headers: { Origin: origin },
      });
      const res = await brandsHttp(request, mockService, origin);
      expect(res.status).toBe(405);
      const data = await res.json();
      expect(data.error).toBe("Method unavailable.");
    }
  });

  it("allows GET without CSRF origin check", async () => {
    const request = new Request("http://localhost:3000/api/brands", {
      method: "GET",
    });
    const res = await brandsHttp(request, mockService, origin);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].name).toBe("GOGI MARU");
  });

  it("allows valid POST with matching Origin and JSON content-type", async () => {
    const request = new Request("http://localhost:3000/api/brands", {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "New Brand" }),
    });
    const res = await brandsHttp(request, mockService, origin);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe("New Brand");
  });
});

describe("Historical Task DTO Nullable Brand Support", () => {
  it("TaskDTO successfully allows null brandId and brandName for historical records", () => {
    const historicalTask: TaskDTO = {
      id: randomUUID(),
      title: "Historical Task",
      description: "No brand attached",
      priority: "NORMAL",
      status: "OPEN",
      assignedDate: "2026-09-01",
      dueDate: null,
      brandId: null,
      brandName: null,
      createdById: randomUUID(),
      assignedToId: randomUUID(),
      creator: { id: randomUUID(), name: "Admin" },
      assignee: { id: randomUUID(), name: "Staff" },
      completedAt: null,
      cancelledAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(historicalTask.brandId).toBeNull();
    expect(historicalTask.brandName).toBeNull();
  });

  it("TaskDTO supports assigned brandId and brandName for new tasks", () => {
    const bId = randomUUID();
    const brandTask: TaskDTO = {
      id: randomUUID(),
      title: "New Task with Brand",
      description: "Has brand attached",
      priority: "HIGH",
      status: "OPEN",
      assignedDate: "2026-09-19",
      dueDate: "2026-09-25",
      brandId: bId,
      brandName: "GOGI MARU",
      createdById: randomUUID(),
      assignedToId: randomUUID(),
      creator: { id: randomUUID(), name: "Admin" },
      assignee: { id: randomUUID(), name: "Staff" },
      completedAt: null,
      cancelledAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(brandTask.brandId).toBe(bId);
    expect(brandTask.brandName).toBe("GOGI MARU");
  });
});
