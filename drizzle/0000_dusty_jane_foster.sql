CREATE TABLE `exams` (
	`id` text PRIMARY KEY NOT NULL,
	`student_code` text NOT NULL,
	`teacher_key` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exams_student_code_unique` ON `exams` (`student_code`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_code` text NOT NULL,
	`student_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
