import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const chargingSlots = sqliteTable("charging_slots", {
  id: text("id").primaryKey(),
  routeId: text("route_id").notNull(),
  stationId: text("station_id").notNull(),
  slotDate: text("slot_date").notNull(),
  startTime: text("start_time").notNull(),
  state: text("state").notNull().default("open"),
  bookingId: text("booking_id").unique(),
  driverAlias: text("driver_alias"),
  bookedAt: text("booked_at"),
}, (table) => [
  index("idx_slots_route_date").on(table.routeId, table.slotDate),
]);

export const stationStates = sqliteTable("station_states", {
  stationId: text("station_id").primaryKey(),
  operational: text("operational").notNull().default("yes"),
});
