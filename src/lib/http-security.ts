export function mutationRequestError(
  request: Request,
  configuredOrigin: string,
): Response | null {
  const headers = { "Cache-Control": "no-store" };
  if (request.headers.get("origin") !== new URL(configuredOrigin).origin)
    return Response.json(
      { error: "Invalid origin." },
      { status: 403, headers },
    );
  const type = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (type !== "application/json")
    return Response.json(
      { error: "JSON content type required." },
      { status: 415, headers },
    );
  return null;
}
