ALTER TABLE `submission_reviews` ADD `reviewed_at` text;
--> statement-breakpoint
UPDATE `submission_reviews` SET `reviewed_at` = `updated_at` WHERE `reviewed_at` IS NULL;
