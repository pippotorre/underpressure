-- UnderPressure: tabella degli utenti registrati (solo nome ed email, nessun dato sanitario).
-- Importa questo file da phpMyAdmin (scheda "Importa") nel database entratad77228.
USE `entratad77228`;

CREATE TABLE IF NOT EXISTS `underpressure_users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(60) NOT NULL,
  `email` VARCHAR(120) NOT NULL,
  `verified` TINYINT(1) NOT NULL DEFAULT 0,
  `code_hash` VARCHAR(255) NULL,
  `code_expires` INT UNSIGNED NULL,
  `code_attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `codes_window` INT UNSIGNED NULL,
  `codes_sent` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `token_hash` CHAR(64) NULL,
  `backup_day` CHAR(10) NULL,
  `backup_count` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `last_backup_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_email` (`email`),
  KEY `idx_token` (`token_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
