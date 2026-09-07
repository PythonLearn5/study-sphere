CREATE TABLE `focus_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`planned_duration` integer NOT NULL,
	`actual_duration` integer,
	`session_type` text DEFAULT 'focus' NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	`notes` text,
	`interruptions` integer DEFAULT 0 NOT NULL,
	`goal_text` text,
	`tags` text DEFAULT '[]',
	`mood` text,
	`productivity` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `user_settings` ADD `study_area_background_image` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `ambient_sound_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `selected_ambient_sound` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `ambient_sound_volume` integer DEFAULT 50 NOT NULL;