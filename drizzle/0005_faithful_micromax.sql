ALTER TABLE `submissions` ADD `student_user_id` text;--> statement-breakpoint
CREATE INDEX `idx_submissions_student_user_id` ON `submissions` (`student_user_id`);