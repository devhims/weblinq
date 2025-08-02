ALTER TABLE `session` ADD `impersonated_by` text;--> statement-breakpoint
CREATE INDEX `idx_session_impersonated` ON `session` (`impersonated_by`);--> statement-breakpoint
ALTER TABLE `user` ADD `role` text DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `user` ADD `banned` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_reason` text;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_expires` integer;--> statement-breakpoint
CREATE INDEX `idx_user_role` ON `user` (`role`);