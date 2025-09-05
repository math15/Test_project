-- Order Assignment App Database Schema
-- This creates the required tables for the order assignment system

-- Create lead_orders table
CREATE TABLE IF NOT EXISTS `lead_orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_number` varchar(100) NOT NULL UNIQUE,
  `states` text NOT NULL COMMENT 'CSV of 2-letter state codes',
  `quantity` int NOT NULL,
  `fulfilled_count` int DEFAULT 0,
  `status` enum('active','fulfilled') DEFAULT 'active',
  `product_name` varchar(255) DEFAULT NULL,
  `actual_order_number` varchar(100) DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_order_number` (`order_number`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create lead_order_states table
CREATE TABLE IF NOT EXISTS `lead_order_states` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `state` varchar(2) NOT NULL,
  `threshold` int DEFAULT 999,
  `fulfilled_count` int DEFAULT 0,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_order_state` (`order_id`, `state`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_state` (`state`),
  FOREIGN KEY (`order_id`) REFERENCES `lead_orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create automation table
CREATE TABLE IF NOT EXISTS `automation` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_name` varchar(100) NOT NULL,
  `order_number` varchar(100) NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_order_number` (`order_number`),
  KEY `idx_order_name` (`order_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note: lead_details table should already exist from the provided dataset
-- Expected structure:
-- CREATE TABLE `lead_details` (
--   `id` int NOT NULL AUTO_INCREMENT,
--   `phone_number` varchar(32) NOT NULL,
--   `state` varchar(2) NOT NULL,
--   `order_number` varchar(100) DEFAULT NULL,
--   -- other columns as provided in dataset
--   PRIMARY KEY (`id`),
--   KEY `idx_state` (`state`),
--   KEY `idx_order_number` (`order_number`)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
