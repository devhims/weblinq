CREATE TABLE `error_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text,
	`user_id` text,
	`level` text DEFAULT 'error' NOT NULL,
	`source` text NOT NULL,
	`operation` text NOT NULL,
	`status_code` integer,
	`error_code` text,
	`message` text NOT NULL,
	`stack_trace` text,
	`url` text,
	`method` text,
	`user_agent` text,
	`ip_address` text,
	`context` text,
	`resolved` integer DEFAULT false,
	`resolution_notes` text,
	`resolved_at` integer,
	`resolved_by` text,
	`occurrence_count` integer DEFAULT 1,
	`first_occurrence` integer NOT NULL,
	`last_occurrence` integer NOT NULL,
	`fingerprint` text,
	`environment` text,
	`version` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_error_user` ON `error_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_error_level` ON `error_logs` (`level`);--> statement-breakpoint
CREATE INDEX `idx_error_source` ON `error_logs` (`source`);--> statement-breakpoint
CREATE INDEX `idx_error_operation` ON `error_logs` (`operation`);--> statement-breakpoint
CREATE INDEX `idx_error_status` ON `error_logs` (`status_code`);--> statement-breakpoint
CREATE INDEX `idx_error_code` ON `error_logs` (`error_code`);--> statement-breakpoint
CREATE INDEX `idx_error_fingerprint` ON `error_logs` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `idx_error_environment` ON `error_logs` (`environment`);--> statement-breakpoint
CREATE INDEX `idx_error_created` ON `error_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_error_resolved` ON `error_logs` (`resolved`);--> statement-breakpoint
CREATE INDEX `idx_error_request` ON `error_logs` (`request_id`);--> statement-breakpoint
DROP INDEX `sub_status`;--> statement-breakpoint
CREATE INDEX `idx_sub_user` ON `subscriptions` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_credit_user` ON `credit_transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_pay_user` ON `payments` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_pay_date` ON `payments` (`paid_at`);--> statement-breakpoint
CREATE INDEX `idx_session_token` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `idx_user_email` ON `user` (`email`);