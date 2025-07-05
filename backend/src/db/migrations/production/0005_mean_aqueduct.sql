DROP INDEX `sub_status`;--> statement-breakpoint
CREATE INDEX `idx_sub_user` ON `subscriptions` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_credit_user` ON `credit_transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_pay_user` ON `payments` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_pay_date` ON `payments` (`paid_at`);--> statement-breakpoint
CREATE INDEX `idx_session_token` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `idx_user_email` ON `user` (`email`);