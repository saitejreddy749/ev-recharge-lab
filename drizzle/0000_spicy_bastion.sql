CREATE TABLE `charging_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`route_id` text NOT NULL,
	`station_id` text NOT NULL,
	`slot_date` text NOT NULL,
	`start_time` text NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`booking_id` text,
	`driver_alias` text,
	`booked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `charging_slots_booking_id_unique` ON `charging_slots` (`booking_id`);--> statement-breakpoint
CREATE INDEX `idx_slots_route_date` ON `charging_slots` (`route_id`,`slot_date`);--> statement-breakpoint
CREATE TABLE `station_states` (
	`station_id` text PRIMARY KEY NOT NULL,
	`operational` text DEFAULT 'yes' NOT NULL
);
