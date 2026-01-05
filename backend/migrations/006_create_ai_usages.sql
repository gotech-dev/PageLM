-- Track AI usage history whenever credits are consumed
CREATE TABLE IF NOT EXISTS ai_usages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id VARCHAR(36) NULL,
  user_id VARCHAR(36) NULL,
  ai_model_id BIGINT UNSIGNED NOT NULL,
  input_tokens INT UNSIGNED DEFAULT 0,
  output_tokens INT UNSIGNED DEFAULT 0,
  credits_used DECIMAL(12,2) NOT NULL,
  task_type VARCHAR(100) NULL,
  input_hash VARCHAR(128) NULL,
  meta JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (ai_model_id) REFERENCES ai_models(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_ai_usages_user_id (user_id),
  INDEX idx_ai_usages_ai_model_id (ai_model_id),
  INDEX idx_ai_usages_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
