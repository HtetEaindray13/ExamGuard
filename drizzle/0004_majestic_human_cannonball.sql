ALTER TABLE `exams` ADD `teacher_user_id` text;--> statement-breakpoint
CREATE INDEX `idx_exams_teacher_user_id` ON `exams` (`teacher_user_id`);