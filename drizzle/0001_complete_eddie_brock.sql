CREATE TABLE `cagen_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cagen_id` integer NOT NULL,
	`document_type_id` integer NOT NULL,
	`s3_key` text NOT NULL,
	`original_filename` text NOT NULL,
	`content_type` text NOT NULL,
	`uploaded_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cagen_id`) REFERENCES `cagens`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`document_type_id`) REFERENCES `document_types`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `document_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`label` text NOT NULL,
	`group` text NOT NULL,
	`peminatan_id` integer,
	`max_files` integer DEFAULT 1 NOT NULL,
	`accept_mime` text NOT NULL,
	`max_size_bytes` integer DEFAULT 2097152 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`peminatan_id`) REFERENCES `peminatan`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_types_slug_unique` ON `document_types` (`slug`);--> statement-breakpoint
CREATE TABLE `peminatan` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nama` text NOT NULL,
	`deskripsi` text NOT NULL,
	`guidebook_url` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `peminatan_nama_unique` ON `peminatan` (`nama`);--> statement-breakpoint
CREATE TABLE `public_qna` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asker_name` text,
	`question` text NOT NULL,
	`answer` text,
	`is_published` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`registration_start` integer,
	`registration_end` integer,
	`is_registration_open` integer DEFAULT false NOT NULL,
	`wa_number` text,
	`wa_message` text
);
--> statement-breakpoint
CREATE TABLE `timeline_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`start_date` integer NOT NULL,
	`end_date` integer,
	`sequence_order` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `cagens` ADD `nomor_registrasi` text;--> statement-breakpoint
ALTER TABLE `cagens` ADD `is_verified` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `cagens` ADD `verification_token` text;--> statement-breakpoint
ALTER TABLE `cagens` ADD `peminatan` text;--> statement-breakpoint
CREATE UNIQUE INDEX `cagens_nomor_registrasi_unique` ON `cagens` (`nomor_registrasi`);