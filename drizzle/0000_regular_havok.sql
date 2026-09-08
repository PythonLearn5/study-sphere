CREATE TABLE `chats` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`prompt` text NOT NULL,
	`response` text NOT NULL,
	`prompt_time` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `daily_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`review_date` integer NOT NULL,
	`completed_tasks` integer DEFAULT 0 NOT NULL,
	`total_tasks` integer DEFAULT 0 NOT NULL,
	`reflection` text,
	`improvements` text,
	`productivity_score` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `decks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`color` text DEFAULT '#3B82F6' NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`study_material` text,
	`total_cards` integer DEFAULT 0 NOT NULL,
	`last_studied` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `flashcard_results` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`flashcard_id` text NOT NULL,
	`result` text NOT NULL,
	`time_to_answer` integer DEFAULT 0 NOT NULL,
	`reviewed_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `study_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`flashcard_id`) REFERENCES `flashcards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `flashcards` (
	`id` text PRIMARY KEY NOT NULL,
	`deck_id` text NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`difficulty` text DEFAULT 'medium' NOT NULL,
	`topic` text NOT NULL,
	`hints` text DEFAULT '[]',
	`explanation` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`correct_count` integer DEFAULT 0 NOT NULL,
	`incorrect_count` integer DEFAULT 0 NOT NULL,
	`last_reviewed` integer,
	`next_review` integer,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`deck_id`) REFERENCES `decks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
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
CREATE TABLE `note_bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`note_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`categories` text NOT NULL,
	`created_at` integer NOT NULL,
	`modified_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quiz_bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`quiz_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quiz_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`quiz_id` text NOT NULL,
	`score` integer NOT NULL,
	`total_questions` integer NOT NULL,
	`time_spent` integer NOT NULL,
	`completed_at` integer NOT NULL,
	`answers` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quiz_subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text DEFAULT '#3B82F6' NOT NULL,
	`icon` text DEFAULT '📚' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quiz_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `quiz_subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`subject_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`difficulty` text DEFAULT 'intermediate' NOT NULL,
	`questions` text NOT NULL,
	`time_limit` integer DEFAULT 300 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `quiz_subjects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `quiz_topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `study_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`deck_id` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`total_cards` integer DEFAULT 0 NOT NULL,
	`correct_answers` integer DEFAULT 0 NOT NULL,
	`incorrect_answers` integer DEFAULT 0 NOT NULL,
	`partial_answers` integer DEFAULT 0 NOT NULL,
	`session_type` text DEFAULT 'study' NOT NULL,
	`time_spent` integer DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deck_id`) REFERENCES `decks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`priority` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`due_date` integer,
	`scheduled_date` integer,
	`scheduled_start_time` text,
	`scheduled_end_time` text,
	`estimated_duration` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`focus_session_duration` integer DEFAULT 90 NOT NULL,
	`break_duration` integer DEFAULT 20 NOT NULL,
	`work_start_time` text DEFAULT '09:00' NOT NULL,
	`work_end_time` text DEFAULT '17:00' NOT NULL,
	`peak_hours_start` text DEFAULT '10:00' NOT NULL,
	`peak_hours_end` text DEFAULT '12:00' NOT NULL,
	`pomodoro_enabled` integer DEFAULT false NOT NULL,
	`pomodoro_work_duration` integer DEFAULT 25 NOT NULL,
	`pomodoro_break_duration` integer DEFAULT 5 NOT NULL,
	`theme_preference` text DEFAULT 'system' NOT NULL,
	`study_area_background_image` text,
	`ambient_sound_enabled` integer DEFAULT false NOT NULL,
	`selected_ambient_sound` text DEFAULT 'none' NOT NULL,
	`ambient_sound_volume` integer DEFAULT 50 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_settings_user_id_unique` ON `user_settings` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`bio` text,
	`display_name` text,
	`avatar_url` text,
	`last_sign_in` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);