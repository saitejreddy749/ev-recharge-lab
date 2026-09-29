"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, BatteryCharging, CalendarClock, Check, Gauge, MapPin, PlugZap, RotateCw, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES, assessStations, arrivalSoc, getRoute, recommendedStation, safeRangeKm, validatePlan, type Connector, type PlanInput, type Slot, type StationAssessment } from "@/lib/charge";

type Network = { slots: Slot[]; operational: Record<string, boolean> };
type Booking = { id: string; station: string; date: string; time: string; arrivalSoc: number; alias: string };
const decimal = (value: number) => Number.isFinite(value) ? value.toFixed(1) : "—";
function tomorrowMorning() {
  return new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) + "T08:00";
}
const initial: PlanInput = {
  routeId: ROUTES[0].id, batteryKwh: 60, currentSoc: 34,
  efficiencyKwhPer100Km: 15.5, reserveSoc: 20, connector: "CCS1",
  departureLocal: tomorrowMorning(),
};

export default function Home() {
  const [plan, setPlan] = useState<PlanInput>(initial);
  const [network, setNetwork] = useState<Network | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [alias, setAlias] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [busy, setBusy] = useState(false);
  const route = getRoute(plan.routeId)!;
  const date = plan.departureLocal.slice(0, 10);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/network?route=${encodeURIComponent(plan.routeId)}&date=${encodeURIComponent(date)}`, { cache: "no-store" });
      const data = await response.json() as Network & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "The demo network could not load.");
      setNetwork({ slots: data.slots, operational: data.operational });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The demo network could not load.");
      setNetwork(null);
    } finally { setLoading(false); }
  }, [plan.routeId, date]);
  useEffect(() => { void refresh(); }, [refresh]);

  const validation = validatePlan(plan);
  const assessments = useMemo(() => network && !validation
    ? assessStations(plan, network.slots, network.operational) : [], [network, plan, validation]);
  const recommendation = recommendedStation(assessments);
  const destinationSoc = validation ? null : arrivalSoc(plan, route.distanceKm);
  const destinationReachable = destinationSoc !== null && destinationSoc >= plan.reserveSoc;
  const range = validation ? null : safeRangeKm(plan);

  function update<K extends keyof PlanInput>(key: K, value: PlanInput[K]) {
    setPlan((current) => ({ ...current, [key]: value }));
    setActiveSlot(null); setBooking(null);
  }
  async function reserve(item: StationAssessment) {
    if (!item.nextSlot || alias.trim().length < 2) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/reservations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, slotId: item.nextSlot.id, slotDate: item.nextSlot.date, alias }),
      });
      const data = await response.json() as { booking: Booking; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Reservation failed.");
      setBooking(data.booking); setActiveSlot(null); setAlias("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Reservation failed.");
      await refresh();
    } finally { setBusy(false); }
  }
  async function adminChange(kind: "station" | "slot", id: string, value: boolean) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId: plan.routeId, date, kind, id, value }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Change failed.");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Change failed."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#f3f6f4] text-[#142b32]">
    <header className="border-b border-[#d9e2de] bg-white">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#0e493f] text-[#baf2d3]"><PlugZap size={22} /></span>
          <div className="leading-tight"><div className="text-[17px] font-bold tracking-tight">EV Recharge Lab</div><div className="text-xs font-medium text-[#5d7777]">Route + reservation simulator</div></div>
        </div>
        <span className="hidden rounded-full border border-[#bcd8ca] bg-[#ebf8ef] px-3 py-1.5 text-xs font-semibold text-[#1d654d] sm:block">Illustrative network · no live chargers</span>
      </div>
    </header>
    <div className="mx-auto max-w-[1440px] px-5 pb-14 pt-7 sm:px-8 lg:px-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><div className="mb-1 text-xs font-bold uppercase tracking-[0.17em] text-[#367664]">Charging decision</div><h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Plan your next stop</h1><p className="mt-2 max-w-2xl text-[15px] leading-6 text-[#57706e]">Find demo chargers that fit your battery reserve, connector and arrival time. Reserve an available slot.</p></div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading} className="border-[#ccdad4] bg-white text-[#315b54]"><RotateCw size={15} className={loading ? "animate-spin" : ""} /> Refresh slots</Button>
      </div>
      {error && <div role="alert" className="mb-5 rounded-xl border border-[#f0c7bd] bg-[#fff4f0] p-4 text-sm text-[#8b3b2e]">{error}</div>}
      {booking && <div role="status" className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-[#9fd6b7] bg-[#e8f8ed] p-4 text-[#18513c]"><Check size={20} /><div><strong>Demo slot reserved for {booking.alias}.</strong><div className="text-sm">{booking.station} · {booking.date} at {booking.time} · estimated arrival {decimal(booking.arrivalSoc)}% SOC</div></div><span className="ml-auto font-mono text-xs">ID {booking.id.slice(0, 8)}</span></div>}

      <Tabs defaultValue="driver" className="gap-5">
        <TabsList className="h-11 rounded-xl border border-[#dbe5e0] bg-white p-1 shadow-sm">
          <TabsTrigger value="driver" className="rounded-lg px-5 py-2 text-sm">Driver planner</TabsTrigger>
          <TabsTrigger value="admin" className="rounded-lg px-5 py-2 text-sm">Network desk</TabsTrigger>
        </TabsList>
        <TabsContent value="driver">
          <div className="grid items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <section className="panel p-5 sm:p-6" aria-labelledby="trip-heading">
              <div className="mb-5 flex items-center gap-2"><SlidersHorizontal size={18} className="text-[#247259]" /><h2 id="trip-heading" className="text-lg font-semibold">Your trip</h2></div>
              <div className="space-y-4">
                <Field label="Demo route" hint="Road distances are illustrative."><NativeSelect value={plan.routeId} onChange={(e) => update("routeId", e.target.value)} className="!h-11 !rounded-lg !border-[#cadbd3] !bg-[#fbfdfb] !text-[15px]">{ROUTES.map((r) => <NativeSelectOption key={r.id} value={r.id}>{r.name} · {r.distanceKm} km</NativeSelectOption>)}</NativeSelect></Field>
                <Field label="Departure" hint="Demo route local time."><Input type="datetime-local" value={plan.departureLocal} onChange={(e) => update("departureLocal", e.target.value)} className="trip-input" /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Battery now" suffix="%"><Input aria-label="Current battery percentage" type="number" min="0" max="100" value={plan.currentSoc} onChange={(e) => update("currentSoc", Number(e.target.value))} className="trip-input" /></Field>
                  <Field label="Keep at least" suffix="%"><Input aria-label="Arrival battery reserve percentage" type="number" min="0" max="50" value={plan.reserveSoc} onChange={(e) => update("reserveSoc", Number(e.target.value))} className="trip-input" /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Usable battery" suffix="kWh"><Input aria-label="Usable battery capacity" type="number" min="10" max="200" step="0.1" value={plan.batteryKwh} onChange={(e) => update("batteryKwh", Number(e.target.value))} className="trip-input" /></Field>
                  <Field label="Consumption" suffix="kWh/100 km"><Input aria-label="Consumption per 100 kilometers" type="number" min="5" max="60" step="0.1" value={plan.efficiencyKwhPer100Km} onChange={(e) => update("efficiencyKwhPer100Km", Number(e.target.value))} className="trip-input" /></Field>
                </div>
                <Field label="Connector"><NativeSelect value={plan.connector} onChange={(e) => update("connector", e.target.value as Connector)} className="!h-11 !rounded-lg !border-[#cadbd3] !bg-[#fbfdfb] !text-[15px]"><NativeSelectOption value="CCS1">CCS1</NativeSelectOption><NativeSelectOption value="NACS">NACS</NativeSelectOption><NativeSelectOption value="J1772">J1772</NativeSelectOption></NativeSelect></Field>
              </div>
              {validation && <p role="alert" className="mt-4 text-sm font-medium text-[#a34434]">{validation}</p>}
              <div className="mt-6 rounded-xl bg-[#f0f7f3] p-4 text-sm leading-6 text-[#4b6861]"><div className="mb-1 flex items-center gap-2 font-semibold text-[#1f5a45]"><ShieldCheck size={17} /> Planning estimate</div>Uses a steady 85 km/h and the entered consumption. Weather, terrain, traffic and battery condition can change the real result.</div>
            </section>

            <section className="min-w-0 space-y-5" aria-label="Charging results">
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric icon={<Gauge size={19} />} label="Range above reserve" value={range === null ? "—" : `${Math.floor(range)} km`} note={`Arrive with at least ${plan.reserveSoc}%`} />
                <Metric icon={<BatteryCharging size={19} />} label="At destination" value={destinationSoc === null ? "—" : `${decimal(destinationSoc)}%`} note={destinationReachable ? "Within your reserve" : "Charging stop needed"} highlight={!destinationReachable && destinationSoc !== null} />
                <Metric icon={<PlugZap size={19} />} label="Bookable stops" value={loading ? "…" : String(assessments.filter((a) => a.eligible).length)} note={`of ${route.stations.length} demo chargers`} />
              </div>
              <div className="panel p-5 sm:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-semibold">Along the route</h2><p className="mt-0.5 text-sm text-[#68807c]">{route.name} · {route.distanceKm} km</p></div><span className="rounded-full bg-[#eef5f1] px-3 py-1 text-xs font-medium text-[#527367]">Demo distance markers</span></div>
                <div className="relative px-2 pb-4 pt-1"><div className="absolute left-3 right-3 top-3.5 h-1 rounded-full bg-[#dcebe2]" /><div className="relative flex justify-between"><RoutePoint label="Start" detail="0 km" />{route.stations.map((s) => <RoutePoint key={s.id} label={s.name.split(" ")[0]} detail={`${s.km} km`} small />)}<RoutePoint label={route.destination} detail={`${route.distanceKm} km`} /></div></div>
              </div>
              {destinationReachable && <div className="notice-green"><Check size={19} className="mt-0.5 shrink-0" /><span>With these assumptions, you can reach {route.destination} above your {plan.reserveSoc}% reserve. A charging stop is optional.</span></div>}
              {!destinationReachable && recommendation && <div className="notice-green"><MapPin size={19} className="mt-0.5 shrink-0" /><span><strong>Suggested: {recommendation.station.name}.</strong> It is the furthest bookable demo stop that keeps your arrival battery at or above {plan.reserveSoc}%.</span></div>}
              {!loading && !destinationReachable && !recommendation && !validation && <div className="rounded-xl border border-[#edcfaa] bg-[#fff8e9] p-4 text-sm text-[#765526]">No suitable demo slot within your reserve and 2-hour arrival window. Try another departure, connector or battery level.</div>}
              <div className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Charging stops</h2><span className="text-sm text-[#68807c]">Slots near arrival</span></div>
                {loading ? <div className="panel p-7 text-[#68807c]">Loading demo availability…</div> : assessments.map((item) =>
                  <StationCard key={item.station.id} item={item} recommended={recommendation?.station.id === item.station.id && !destinationReachable}
                    active={activeSlot === item.nextSlot?.id} alias={alias} setAlias={setAlias}
                    onSelect={() => setActiveSlot(item.nextSlot?.id ?? null)} onCancel={() => setActiveSlot(null)}
                    onReserve={() => void reserve(item)} busy={busy} />)}
              </div>
            </section>
          </div>
        </TabsContent>
        <TabsContent value="admin">
          <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <section className="panel p-6"><div className="flex items-center gap-2"><SlidersHorizontal size={18} className="text-[#247259]" /><h2 className="text-lg font-semibold">Network desk</h2></div><p className="mt-3 text-sm leading-6 text-[#5d7774]">This role switch is for the private demonstration. It has no separate administrator sign-in.</p><p className="mt-4 text-sm font-semibold">{route.name}</p><p className="text-sm text-[#68807c]">Slots for {date}. Change the date in Driver planner to view another day.</p><div className="mt-5 rounded-xl bg-[#f0f7f3] p-4 text-sm leading-6 text-[#4b6861]">Changes and reservations persist in the demo database. Booked slots cannot be blocked.</div></section>
            <section className="space-y-4"><div><h2 className="text-xl font-semibold">Station availability</h2><p className="mt-1 text-sm text-[#68807c]">Pause a charger or close an individual slot.</p></div>
              {loading ? <p className="panel p-6 text-[#68807c]">Loading network…</p> : route.stations.map((station) => {
                const live = network?.operational[station.id] !== false;
                const slots = network?.slots.filter((slot) => slot.stationId === station.id) ?? [];
                return <div key={station.id} className="panel p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{station.name}</h3><p className="text-sm text-[#68807c]">{station.area} · {station.connector} · {station.powerKw} kW</p></div><Button variant="outline" size="sm" disabled={busy} onClick={() => void adminChange("station", station.id, !live)} className={live ? "border-[#b8dbc6] text-[#206b4f]" : "border-[#e5c5bc] text-[#9c4d3c]"}>{live ? "Operational" : "Offline"} · change</Button></div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{slots.map((slot) => <div key={slot.id} className="rounded-xl border border-[#e0e9e4] bg-[#fafcfb] p-3"><div className="flex items-center justify-between gap-2"><strong className="text-sm">{slot.time}</strong><span className={`text-xs font-semibold ${slot.bookingId ? "text-[#28694e]" : slot.state === "blocked" ? "text-[#a24d3a]" : "text-[#658078]"}`}>{slot.bookingId ? "Reserved" : slot.state === "blocked" ? "Blocked" : "Open"}</span></div>{slot.bookingId ? <p className="mt-2 truncate text-xs text-[#658078]">{slot.driverAlias} · {slot.bookingId.slice(0, 8)}</p> : <button type="button" disabled={busy} onClick={() => void adminChange("slot", slot.id, slot.state === "blocked")} className="mt-2 text-xs font-semibold text-[#246b54] underline underline-offset-2 disabled:opacity-50">{slot.state === "blocked" ? "Reopen slot" : "Block slot"}</button>}</div>)}</div>
                </div>;
              })}
            </section>
          </div>
        </TabsContent>
      </Tabs>
      <footer className="mt-10 flex flex-wrap justify-between gap-2 border-t border-[#d6e1db] pt-5 text-xs leading-5 text-[#6d847e]"><span>EV Recharge Lab · transparent charging decisions</span><span>Fictional chargers · illustrative road distances · demo bookings only</span></footer>
    </div>
  </main>;
}

function Field({ label, hint, suffix, children }: { label: string; hint?: string; suffix?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 flex items-center justify-between gap-1 text-sm font-semibold text-[#2a4547]"><span>{label}</span>{suffix && <span className="text-xs font-medium text-[#78908a]">{suffix}</span>}</span>{children}{hint && <span className="mt-1 block text-xs text-[#78908a]">{hint}</span>}</label>;
}
function Metric({ icon, label, value, note, highlight }: { icon: React.ReactNode; label: string; value: string; note: string; highlight?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${highlight ? "border-[#efd6af] bg-[#fffaf0]" : "border-[#d7e2dc] bg-white"}`}><div className="flex items-center gap-2 text-[#4e7870]">{icon}<span className="text-xs font-semibold uppercase tracking-[0.07em]">{label}</span></div><div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div><p className="mt-0.5 text-xs text-[#728783]">{note}</p></div>;
}
function RoutePoint({ label, detail, small }: { label: string; detail: string; small?: boolean }) {
  return <div className="flex w-10 flex-col items-center text-center sm:w-16"><span className={`z-10 mb-3 rounded-full border-[3px] border-white bg-[#2a8065] shadow-[0_0_0_1px_#a6cfb9] ${small ? "size-5" : "size-6"}`} /><span className="max-w-16 truncate text-[11px] font-semibold text-[#315651]">{label}</span><span className="text-[10px] text-[#81938d]">{detail}</span></div>;
}
function StationCard({ item, recommended, active, alias, setAlias, onSelect, onCancel, onReserve, busy }: {
  item: StationAssessment; recommended: boolean; active: boolean; alias: string;
  setAlias: (value: string) => void; onSelect: () => void; onCancel: () => void; onReserve: () => void; busy: boolean;
}) {
  return <article className={`rounded-2xl border bg-white p-5 sm:p-6 ${recommended ? "border-[#6bb58d] ring-1 ring-[#b9dfc7]" : "border-[#d7e2dc]"}`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${item.eligible ? "bg-[#e2f5e9] text-[#287854]" : "bg-[#f0f3f1] text-[#82938d]"}`}><PlugZap size={21} /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold">{item.station.name}</h3>{recommended && <span className="rounded-full bg-[#dff3e5] px-2 py-0.5 text-[11px] font-bold text-[#237451]">Suggested</span>}</div><p className="mt-0.5 text-sm text-[#6c837d]">{item.station.area} · {item.station.km} km along route</p></div></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.eligible ? "bg-[#e7f6ea] text-[#25714c]" : "bg-[#f2f4f2] text-[#73857f]"}`}>{item.eligible ? "Bookable" : "Unavailable"}</span></div>
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#edf1ee] pt-4 text-sm"><span className="inline-flex items-center gap-1.5 text-[#46635f]"><BatteryCharging size={16} />{decimal(item.arrivalSoc)}% on arrival</span><span className="inline-flex items-center gap-1.5 text-[#46635f]"><PlugZap size={16} />{item.station.connector} · {item.station.powerKw} kW</span><span className="inline-flex items-center gap-1.5 text-[#46635f]"><CalendarClock size={16} />ETA {item.arrivalLocal.slice(11)}</span></div>
    {item.eligible && item.nextSlot ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f2f8f4] p-3.5"><div className="text-sm"><span className="font-semibold text-[#285b46]">Next slot {item.nextSlot.time}</span><span className="ml-2 text-[#718a7d]">· wait about {item.waitMinutes} min</span></div><Button size="sm" className="bg-[#0f5947] hover:bg-[#0b4739]" onClick={onSelect}>Reserve <ArrowRight size={15} /></Button></div> : <div className="mt-4 flex flex-wrap gap-2">{item.reasons.map((reason) => <span key={reason} className="rounded-md bg-[#f6f4ef] px-2.5 py-1.5 text-xs font-medium text-[#856e59]">{reason}</span>)}</div>}
    {active && item.eligible && <form onSubmit={(e) => { e.preventDefault(); onReserve(); }} className="mt-4 flex flex-wrap items-end gap-3 border-t border-[#e5ede7] pt-4"><label className="min-w-[190px] flex-1 text-sm font-semibold text-[#365952]">Name for demo booking<Input autoFocus maxLength={40} minLength={2} required value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="e.g. Alex" className="mt-1.5 h-10 rounded-lg border-[#cadbd3]" /></label><Button type="submit" disabled={busy || alias.trim().length < 2} className="bg-[#0f5947] hover:bg-[#0b4739]">Confirm slot</Button><Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button></form>}
  </article>;
}
