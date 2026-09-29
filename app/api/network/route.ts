import { getNetwork } from "@/lib/network";

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const data = await getNetwork(url.searchParams.get("route") ?? "", url.searchParams.get("date") ?? "");
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load the demo network.";
    return Response.json({ error: message }, { status: message.startsWith("Choose") ? 400 : 503 });
  }
}
