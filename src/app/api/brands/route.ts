import { handleBrands } from "@/lib/brands/server";

export function GET(request: Request) {
  return handleBrands(request);
}

export function POST(request: Request) {
  return handleBrands(request);
}
