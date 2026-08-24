import { readFile } from "fs/promises";
import { join } from "path";
import { isLocalProtoTestEnabled } from "@/lib/proto-test-local";

export const runtime = "nodejs";

export async function GET() {
  if (!isLocalProtoTestEnabled()) {
    return new Response("Not Found", { status: 404 });
  }
  const html = await readFile(join(process.cwd(), "src/app/proto-test/view.html"), "utf8");
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
