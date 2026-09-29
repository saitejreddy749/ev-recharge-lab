import { getRoute } from "@/lib/charge";
import { getNetwork, setSlotBlocked, setStationOperational } from "@/lib/network";

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as {
      routeId?: string;
      date?: string;
      kind?: "station" | "slot";
      id?: string;
      value?: boolean;
    };
    if (!body.routeId || !body.date || !body.id || typeof body.value !== "boolean") {
      return Response.json({ error: "Invalid change." }, { status: 400 });
    }
    const network = await getNetwork(body.routeId, body.date);
    if (body.kind === "station") {
      if (!getRoute(body.routeId)?.stations.some((station) => station.id === body.id)) {
        return Response.json({ error: "Unknown station." }, { status: 404 });
      }
      await setStationOperational(body.id, body.value);
    } else if (body.kind === "slot") {
      if (!network.slots.some((slot) => slot.id === body.id)) {
        return Response.json({ error: "Unknown slot." }, { status: 404 });
      }
      const changed = await setSlotBlocked(body.id, !body.value);
      if (!changed) return Response.json({ error: "A reserved slot cannot be blocked." }, { status: 409 });
    } else {
      return Response.json({ error: "Unknown change." }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "The change could not be saved." }, { status: 503 });
  }
}
