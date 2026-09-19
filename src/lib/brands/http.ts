import { ZodError } from "zod";
import { AccessError } from "../auth/permissions";
import type { brandService } from "./service";
import { mutationRequestError } from "../http-security";

export async function brandsHttp(
  request: Request,
  service: ReturnType<typeof brandService>,
  origin: string,
) {
  const headers = { "Cache-Control": "no-store" };
  const response = (body: unknown, status = 200) =>
    Response.json(body, { status, headers });

  if (request.method === "POST") {
    const invalid = mutationRequestError(request, origin);
    if (invalid) return invalid;
  }

  try {
    if (request.method === "GET") {
      return response(await service.listBrands(request.headers));
    }
    if (request.method !== "POST") {
      return response({ error: "Method unavailable." }, 405);
    }
    const input: unknown = await request.json();
    return response(await service.createBrand(request.headers, input), 201);
  } catch (error: unknown) {
    if (error instanceof AccessError) {
      return response({ error: error.message }, error.status);
    }
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return response(
        { error: "Dữ liệu brand không hợp lệ. Vui lòng kiểm tra lại." },
        400,
      );
    }
    return response(
      { error: "Thao tác brand thất bại. Vui lòng thử lại." },
      503,
    );
  }
}
