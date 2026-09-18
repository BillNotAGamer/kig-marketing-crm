import { handleAssets } from "@/lib/assets/server";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string; assetId: string }> },
) {
  const params = await props.params;
  return handleAssets(request, params.id, params.assetId, true);
}
