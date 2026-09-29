import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

test("a slot can be claimed once, even when a second request uses stale availability", () => {
  const db = new DatabaseSync(":memory:");
  const migration = readFileSync(new URL("../drizzle/0000_spicy_bastion.sql", import.meta.url), "utf8");
  db.exec(migration.replaceAll("--> statement-breakpoint", ""));
  db.prepare("INSERT INTO charging_slots (id, route_id, station_id, slot_date, start_time) VALUES (?, ?, ?, ?, ?)")
    .run("sample", "houston-austin", "prairie", "2026-09-26", "09:00");
  const claim = db.prepare(
    "UPDATE charging_slots SET booking_id = ?, driver_alias = ?, booked_at = ? WHERE id = ? AND state = 'open' AND booking_id IS NULL"
  );
  assert.equal(claim.run("one", "Alex", "now", "sample").changes, 1);
  assert.equal(claim.run("two", "Sam", "now", "sample").changes, 0);
  assert.equal(db.prepare("SELECT booking_id FROM charging_slots WHERE id = ?").get("sample").booking_id, "one");
  db.close();
});
