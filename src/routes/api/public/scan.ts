import { createFileRoute } from "@tanstack/react-router";

/**
 * Radar scan + call-monitoring cycle.
 * Called by an external scheduler. Requires the XOWL_SCAN_SECRET bearer/query key.
 */
export const Route = createFileRoute("/api/public/scan")({
  server: {
    handlers: {
      GET: async ({ request }) => run(request),
      POST: async ({ request }) => run(request),
    },
  },
});

async function run(request: Request) {
  const secret = (process.env["XOWL_SCAN_SECRET"] ?? "").trim();
  if (!secret) return Response.json({ error: "Scanner not configured" }, { status: 503 });

  const url = new URL(request.url);
  const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") || (url.searchParams.get("key") ?? "");
  if (provided !== secret) return new Response("Unauthorized", { status: 401 });

  const { runScanCycle } = await import("@/lib/calls.server");
  try {
    const result = await runScanCycle();
    return Response.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (error) {
    console.error("scan cycle failed", error);
    return Response.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
