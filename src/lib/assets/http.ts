import { ZodError } from "zod";
import { AccessError } from "../auth/permissions";
import type { assetService } from "./service";

export async function assetsHttp(
  request: Request,
  service: ReturnType<typeof assetService>,
  origin: string,
  taskId: string,
  assetId?: string,
  isRemove = false,
) {
  const response = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

  if (
    request.method !== "GET" &&
    request.headers.get("origin") !== new URL(origin).origin
  ) {
    return response({ error: "Invalid origin." }, 403);
  }

  try {
    if (request.method === "GET" && !assetId) {
      return response(await service.getTaskAssets(request.headers, taskId));
    }

    if (request.method !== "POST") {
      return response({ error: "Method unavailable." }, 405);
    }

    if (isRemove && assetId) {
      let input: unknown = {};
      try {
        const text = await request.text();
        input = text ? JSON.parse(text) : {};
      } catch {
        input = {};
      }
      await service.removeAsset(request.headers, taskId, assetId, input);
      return response({ success: true }, 200);
    }

    if (!assetId) {
      const input: unknown = await request.json();
      const created = await service.addAsset(request.headers, taskId, input);
      return response(created, 201);
    }

    return response({ error: "Unknown command." }, 400);
  } catch (error: unknown) {
    if (error instanceof AccessError) {
      return response({ error: error.message }, error.status);
    }
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return response({ error: "Invalid deliverable payload." }, 400);
    }
    return response(
      { error: "Deliverable operation failed. Please retry." },
      503,
    );
  }
}
