CREATE TABLE `admins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nama_lengkap` text NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admins_username_unique` ON `admins` (`username`);--> statement-breakpoint
CREATE TABLE `berkas_cagens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cagen_id` integer NOT NULL,
	`ktm` text NOT NULL,
	`transkrip_nilai` text NOT NULL,
	`pas_foto` text NOT NULL,
	`cv` text NOT NULL,
	`bukti_follow` text NOT NULL,
	`bukti_share` text NOT NULL,
	`sertifikat_prestasi` text,
	`sertifikat_bahasa` text,
	`sertifikat_organisasi` text,
	`peminatan` text NOT NULL,
	`file_karya` text NOT NULL,
	`waktu_upload` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cagen_id`) REFERENCES `cagens`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `cagens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`nama_lengkap` text NOT NULL,
	`nama_panggilan` text NOT NULL,
	`nim` text NOT NULL,
	`no_wa` text NOT NULL,
	`fakultas` text NOT NULL,
	`jurusan` text NOT NULL,
	`angkatan` text NOT NULL,
	`status_pendaftaran` text DEFAULT 'Belum Melengkapi' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cagens_email_unique` ON `cagens` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `cagens_nim_unique` ON `cagens` (`nim`);