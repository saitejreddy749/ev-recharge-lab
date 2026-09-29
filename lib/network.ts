import { env } from "cloudflare:workers";
import { getRoute, SLOT_TIMES, type Slot } from "./charge";

function db() {
  if (!env.DB) throw new Error("The demo database is unavailable.");
  return env.DB;
}

export function validDemoDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const value = Date.parse(date + "T00:00:00Z");
  if (Number.isNaN(value) || new Date(value).toISOString().slice(0, 10) !== date) return false;
  const today = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  return value >= today && value <= today + 30 * 86_400_000;
}

export async function getNetwork(routeId: string, date: string) {
  const route = getRoute(routeId);
  if (!route || !validDemoDate(date)) throw new Error("Choose a valid demo route and date within 30 days.");
  const database = db();
  const inserts = route.stations.flatMap((station) =>
    SLOT_TIMES.map((time) => database.prepare(
      "INSERT OR IGNORE INTO charging_slots (id, route_id, station_id, slot_date, start_time) VALUES (?, ?, ?, ?, ?)"
    ).bind(`${routeId}:${station.id}:${date}:${time}`, routeId, station.id, date, time))
  );
  await database.batch(inserts);
  const [slotRows, stateRows] = await Promise.all([
    database.prepare(
      "SELECT id, route_id AS routeId, station_id AS stationId, slot_date AS date, start_time AS time, state, booking_id AS bookingId, driver_alias AS driverAlias, booked_at AS bookedAt FROM charging_slots WHERE route_id = ? AND slot_date = ? ORDER BY station_id, start_time"
    ).bind(routeId, date).all<Slot>(),
    database.prepare("SELECT station_id AS stationId, operational FROM station_states").all<{stationId: string; operational: string}>(),
  ]);
  const operational = Object.fromEntries(stateRows.results.map((row) => [row.stationId, row.operational === "yes"]));
  return { route, slots: slotRows.results, operational };
}

export async function reserveSlot(id: string, alias: string, bookingId: string) {
  const result = await db().prepare(
    "UPDATE charging_slots SET booking_id = ?, driver_alias = ?, booked_at = ? WHERE id = ? AND state = 'open' AND booking_id IS NULL"
  ).bind(bookingId, alias, new Date().toISOString(), id).run();
  return result.meta.changes === 1;
}

export async function setSlotBlocked(id: string, blocked: boolean) {
  const result = await db().prepare(
    "UPDATE charging_slots SET state = ? WHERE id = ? AND booking_id IS NULL"
  ).bind(blocked ? "blocked" : "open", id).run();
  return result.meta.changes === 1;
}

export async function setStationOperational(stationId: string, operational: boolean) {
  await db().prepare(
    "INSERT INTO station_states (station_id, operational) VALUES (?, ?) ON CONFLICT(station_id) DO UPDATE SET operational = excluded.operational"
  ).bind(stationId, operational ? "yes" : "no").run();
}
