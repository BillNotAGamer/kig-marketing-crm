import { ZodError } from "zod";
import { AccessError } from "../auth/permissions";
import type { userService } from "./service";
import { mutationRequestError } from "../http-security";

export async function usersHttp(
  request: Request,
  service: ReturnType<typeof userService>,
  origin: string,
  target?: string,
) {
  if (request.method === "POST") {
    const invalid = mutationRequestError(request, origin);
    if (invalid) return invalid;
  }
  try {
    if (request.method === "GET" && !target)
      return Response.json(await service.list(request.headers), {
        headers: { "Cache-Control": "no-store" },
      });
    if (request.method !== "POST")
      return Response.json({ error: "Method unavailable." }, { status: 405 });
    const input: unknown = await request.json();
    const result =
      target === "own-password"
        ? await service.changeOwnPassword(request.headers, input)
        : target
          ? await service.command(request.headers, target, input)
          : await service.create(request.headers, input);
    return Response.json(result, {
      status: target ? 200 : 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    if (error instanceof AccessError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof ZodError || error instanceof SyntaxError)
      return Response.json(
        {
          error:
            "Invalid input. Check the required fields and password policy.",
        },
        { status: 400 },
      );
    // Never expose driver/library errors, input values or credential material.
    return Response.json(
      {
        error:
          "Operation failed. Check the identity, current password or duplicate email and retry.",
      },
      { status: 400 },
    );
  }
}
