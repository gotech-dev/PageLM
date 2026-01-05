-- AI models catalogue for pricing and selection
CREATE TABLE IF NOT EXISTS ai_models (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider_id BIGINT UNSIGNED NULL,
  name VARCHAR(100) NOT NULL UNIQUE,
  type ENUM('text', 'audio', 'image', 'other') NOT NULL DEFAULT 'text',
  cost_input DECIMAL(12,6) NULL,
  cost_cached_input DECIMAL(12,6) NULL,
  cost_output DECIMAL(12,6) NULL,
  pricing_type ENUM('token_based', 'duration_based', 'per_image', 'per_unit') NOT NULL DEFAULT 'token_based',
  cost_per_unit DECIMAL(12,6) NULL,
  unit VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ai_models_provider (provider_id),
  INDEX idx_ai_models_type (type),
  INDEX idx_ai_models_pricing (pricing_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
