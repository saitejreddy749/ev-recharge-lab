import assert from "node:assert/strict";
import test from "node:test";
import { assessStations, arrivalSoc, safeRangeKm, validatePlan } from "../lib/charge.ts";

const trip = {
  routeId: "houston-austin", batteryKwh: 60, currentSoc: 34,
  efficiencyKwhPer100Km: 15.5, reserveSoc: 20, connector: "CCS1",
  departureLocal: "2026-09-26T08:00",
};
const slot = (stationId, state = "open", bookingId = null) => ({
  id: `houston-austin:${stationId}:2026-09-26:09:00`,
  routeId: "houston-austin", stationId, date: "2026-09-26", time: "09:00",
  state, bookingId, driverAlias: null, bookedAt: null,
});

test("reserve is a percentage of total battery capacity, not remaining energy", () => {
  assert.ok(Math.abs(safeRangeKm(trip) - 54.1935483871) < 0.0001);
  assert.ok(arrivalSoc(trip, 54.1935483871) >= 19.999999);
  assert.equal(safeRangeKm({ ...trip, currentSoc: 15 }), 0);
});

test("the first compatible stop is reachable; the next is not", () => {
  const result = assessStations(trip, [slot("prairie"), slot("brazos")], {});
  assert.equal(result[0].eligible, true);
  assert.ok(result[0].arrivalSoc > 20);
  assert.equal(result[1].eligible, false);
  assert.ok(result[1].reasons.includes("Below your arrival reserve"));
  assert.ok(result[1].reasons.includes("Needs NACS connector"));
});

test("a booked, blocked, late or offline charger cannot be recommended", () => {
  assert.equal(assessStations(trip, [slot("prairie", "open", "already-booked")], {})[0].eligible, false);
  assert.equal(assessStations(trip, [slot("prairie", "blocked")], {})[0].eligible, false);
  assert.equal(assessStations(trip, [slot("prairie")], { prairie: false })[0].eligible, false);
  assert.equal(assessStations({ ...trip, departureLocal: "2026-09-26T12:00" }, [slot("prairie")], {})[0].eligible, false);
});

test("invalid physical inputs are rejected", () => {
  assert.match(validatePlan({ ...trip, currentSoc: 101 }), /battery/);
  assert.match(validatePlan({ ...trip, reserveSoc: -1 }), /Reserve/);
  assert.match(validatePlan({ ...trip, batteryKwh: 0 }), /battery/);
  assert.equal(validatePlan(trip), null);
});
