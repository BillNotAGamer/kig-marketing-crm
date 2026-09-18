import { handleAssets } from "@/lib/assets/server";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  return handleAssets(request, (await props.params).id);
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  return handleAssets(request, (await props.params).id);
}
