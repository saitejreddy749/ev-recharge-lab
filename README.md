# EV Recharge Lab

A working EV charging decision and reservation **simulation**. Drivers enter a battery level, vehicle energy use, connector and departure time. The app estimates which chargers on a demo route can be reached above a chosen battery reserve, checks slots near arrival, explains exclusions and reserves a slot. The network desk can mark a charger offline or block a slot.

The two routes, road distances, chargers and time slots are illustrative fixtures. Reservations exist only in this project's database. The app does not control public chargers or use real-time charger telemetry.

## Why this project

A charger marker alone does not answer whether a driver can reach it, use its connector and find an open slot on arrival. This project demonstrates the full decision and the booking race, while keeping the assumptions visible.

## Features

- Transparent arrival battery estimate and minimum arrival reserve
- Connector, station status and arrival-time slot checks
- Explanations for every excluded charging stop
- Persistent demo reservations with a conditional database update that prevents two drivers claiming the same slot
- Network desk for charger status, slot blocking and reservation visibility
- Responsive driver and operator views; useful defaults for a low-battery scenario

## Calculation

`arrival_soc = current_soc - (distance_km × consumption_kwh_per_100km / 100) / usable_battery_kwh × 100`

`safe_range_km = max(0, (current_soc - reserve_soc) / 100 × usable_battery_kwh / (consumption_kwh_per_100km / 100))`

For 60 kWh usable capacity, 34% current charge, 20% minimum arrival charge and 15.5 kWh/100 km, the planning range is about **54 km**. Treating the reserve as 20% of *remaining range* would incorrectly suggest about 105 km and arrive with only about 7% charge.

Travel time uses a constant 85 km/h. Only slots within two hours after estimated arrival count. The suggested stop is the furthest eligible one along the selected demo route. This is an explainable rule, not a claim of optimal routing.

## Stack and structure

- React + TypeScript, Vinext/Next-compatible routing, Tailwind
- Cloudflare Workers and D1 SQLite through the Sites deployment workflow
- `lib/charge.ts`: pure range and recommendation rules
- `lib/network.ts`: D1 reads and conditional writes
- `app/api/`: network, reservation and network-desk endpoints
- `db/schema.ts` and `drizzle/`: schema and generated migration

## Development

Use Node 22+ and install dependencies with `pnpm install`. Run `pnpm db:local` once to apply the checked-in migration to local D1, then `pnpm dev`. The local Wrangler file uses a placeholder database ID for development only. The checked-in `.openai/hosting.json` declares the logical binding; the Sites host creates the real database and applies migrations at deployment. For a standalone Cloudflare deployment, provision a D1 database and replace the placeholder with its real binding in your own Wrangler configuration.

Run `pnpm test` for decision-rule and conditional-booking checks. Run `pnpm build` to verify the Worker bundle.

## Scope and safety

The initial deployment is **private**. The network desk is a demo role switch and has no separate administrator authentication. Add proper server-side authorization before making a writable deployment public. Driver names are demo aliases; do not enter personal data.

This is not driving guidance: distances, speed and chargers are fixtures. Battery consumption can change with weather, traffic, speed, terrain and battery condition. A real product would need a licensed routing provider, trustworthy charger status, an operator agreement for reservations and validation against vehicle telemetry.
