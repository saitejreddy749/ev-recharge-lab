import { assessStations, validatePlan, type PlanInput } from "@/lib/charge";
import { getNetwork, reserveSlot } from "@/lib/network";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { plan?: PlanInput; slotId?: string; slotDate?: string; alias?: string };
    const plan = body.plan;
    const alias = body.alias?.trim() ?? "";
    if (!plan || validatePlan(plan) || alias.length < 2 || alias.length > 40 ||
        !body.slotId || body.slotId.length > 160 || !body.slotDate) {
      return Response.json({ error: "Check the trip details and enter a name of 2–40 characters." }, { status: 400 });
    }
    const network = await getNetwork(plan.routeId, body.slotDate);
    const assessment = assessStations(plan, network.slots, network.operational)
      .find((item) => item.eligible && item.nextSlot?.id === body.slotId);
    if (!assessment) {
      return Response.json({ error: "This slot is no longer suitable or available. Refresh the plan." }, { status: 409 });
    }
    const bookingId = crypto.randomUUID();
    const saved = await reserveSlot(body.slotId, alias, bookingId);
    if (!saved) {
      return Response.json({ error: "Someone booked or blocked that slot first. Choose another." }, { status: 409 });
    }
    return Response.json({
      booking: {
        id: bookingId,
        station: assessment.station.name,
        date: assessment.nextSlot!.date,
        time: assessment.nextSlot!.time,
        arrivalSoc: assessment.arrivalSoc,
        alias,
      },
    }, { status: 201 });
  } catch {
    return Response.json({ error: "The reservation could not be saved. Try again." }, { status: 503 });
  }
}
