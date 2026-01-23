-- ============================================
-- Study with AI Platform Integration Schema
-- Version: 1.0.0
-- Created: 2025-01-22
-- ============================================

-- Add additional columns to existing users table for platform integration
ALTER TABLE users 
ADD COLUMN phone VARCHAR(20) NULL,
ADD COLUMN birth_date DATE NULL,
ADD COLUMN credits INT DEFAULT 0,
ADD COLUMN domain_url VARCHAR(255) NULL,
ADD COLUMN external_platform_id INT NULL,
ADD COLUMN source_platform VARCHAR(50) NULL;

-- Add indexes for new columns
ALTER TABLE users ADD INDEX idx_phone (phone);
ALTER TABLE users ADD INDEX idx_external_platform_id (external_platform_id);
ALTER TABLE users ADD INDEX idx_source_platform (source_platform);

-- External platforms table (for multi-platform support)
CREATE TABLE IF NOT EXISTS external_platforms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  platform_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  api_url VARCHAR(255) NOT NULL,
  secret_key VARCHAR(255) NOT NULL,
  sync_endpoint VARCHAR(255) NOT NULL,
  sso_endpoint VARCHAR(255) NOT NULL,
  token_type ENUM('hmac', 'aes') DEFAULT 'hmac',
  hmac_secret TEXT NULL,
  use_function_code_in_url BOOLEAN DEFAULT TRUE,
  function_codes JSON NULL,
  default_redirect VARCHAR(255) DEFAULT '/dashboard',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_platform_code (platform_code),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User-Platform pivot table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS user_platforms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  external_platform_id INT NOT NULL,
  is_origin BOOLEAN DEFAULT FALSE, -- TRUE if this is the user's original platform
  redirected_at TIMESTAMP NULL, -- When user was redirected to this platform
  last_synced_at TIMESTAMP NULL, -- Last time user data was synced to this platform
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_user_platform (user_id, external_platform_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (external_platform_id) REFERENCES external_platforms(id) ON DELETE CASCADE,
  INDEX idx_user_platforms_user_id (user_id),
  INDEX idx_user_platforms_platform_id (external_platform_id),
  INDEX idx_user_platforms_is_origin (is_origin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default platforms
INSERT INTO external_platforms (
  platform_code, name, api_url, secret_key, sync_endpoint, sso_endpoint, 
  token_type, hmac_secret, use_function_code_in_url, function_codes, default_redirect
) VALUES 
(
  'study_with_ai', 
  'Study with AI', 
  'https://ass.polypi.ai/', 
  '404097399229afadc14da64230bbac81', 
  '/api/syncUser', 
  '/auth/sso-study-with-ai', 
  'aes', 
  'faa700329a79a111e7e028e2ece756db3c5f7d19a2d1b03c90ed219811a9236d', 
  TRUE, 
  '{"1": "/dashboard", "2": "/profile", "3": "/credit-topup", "4": "/api/logAiUsage"}', 
  '/dashboard'
),
(
  'bgtt', 
  'BGTT Platform', 
  'https://bgtt.polypi.ai/', 
  'default_secret_key', 
  '/api/syncUser', 
  '/auth/sso', 
  'aes', 
  'default_hmac_secret', 
  TRUE, 
  '{"1": "/dashboard", "2": "/profile", "3": "/credit-topup", "4": "/api/logAiUsage"}', 
  '/dashboard'
),
(
  'career_guidance', 
  'Career Guidance', 
  'https://huongnghiep.gotechjsc.com/', 
  '404097399229afadc14da64230bbac81', 
  '/api/syncUser', 
  '/auth/sso', 
  'aes', 
  NULL, 
  FALSE, 
  NULL, 
  '/dashboard'
) ON DUPLICATE KEY UPDATE 
  name = VALUES(name),
  api_url = VALUES(api_url),
  sync_endpoint = VALUES(sync_endpoint),
  sso_endpoint = VALUES(sso_endpoint),
  token_type = VALUES(token_type),
  use_function_code_in_url = VALUES(use_function_code_in_url),
  function_codes = VALUES(function_codes),
  default_redirect = VALUES(default_redirect);
