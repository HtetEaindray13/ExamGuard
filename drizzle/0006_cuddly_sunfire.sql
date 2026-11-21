CREATE TABLE `submission_reviews` (
	`submission_id` text PRIMARY KEY NOT NULL,
	`teacher_user_id` text NOT NULL,
	`decision` text NOT NULL,
	`feedback` text DEFAULT '' NOT NULL,
	`manual_score` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_submission_reviews_teacher_user_id` ON `submission_reviews` (`teacher_user_id`);