-- Seed ai_models with common models and pricing
INSERT INTO ai_models (provider_id, name, type, cost_input, cost_cached_input, cost_output, pricing_type, cost_per_unit, unit)
VALUES
  (1, 'gpt-5', 'text', 1.25, 0.125, 10, 'token_based', NULL, NULL),
  (1, 'gpt-5-mini', 'text', 0.25, 0.025, 2, 'token_based', NULL, NULL),
  (1, 'gpt-5-nano', 'text', 0.05, 0.005, 0.4, 'token_based', NULL, NULL),
  (1, 'gpt-5-chat-latest', 'text', 0.25, 0.125, 2, 'token_based', NULL, NULL),
  (1, 'gpt-4o', 'text', 2.5, 1.25, 10, 'token_based', NULL, NULL),
  (1, 'gpt-4o-mini', 'text', 0.15, 0.05, 0.6, 'token_based', NULL, NULL),
  (2, 'black-forest-labs/flux-schnell', 'text', 0, NULL, 0, 'token_based', NULL, NULL),
  (2, 'aesthetic', 'text', 0, NULL, 0, 'token_based', NULL, NULL),
  (2, 'diffusion', 'text', 0, NULL, 0, 'token_based', NULL, NULL),
  (2, 'latent-consistency', 'text', 0, NULL, 0, 'token_based', NULL, NULL),
  (4, 'claude-3-sonnet-20240229', 'text', 0, NULL, 0, 'token_based', NULL, NULL),
  (4, 'claude-3-5-sonnet-20240620', 'text', 0, NULL, 0, 'token_based', NULL, NULL),
  (2, 'sticker-maker', 'text', 0, NULL, 0, 'token_based', NULL, NULL),
  (2, 'proteus-v0.3', 'text', 0, NULL, 0, 'token_based', NULL, NULL),
  (1, 'whisper-1', 'audio', 0, NULL, 0, 'duration_based', 0.006000, 'minute'),
  (1, 'gpt-5-pro', 'text', 15, NULL, 120, 'token_based', NULL, NULL),
  (4, 'claude-sonnet-4-5-20250929', 'text', 3, 1.5, 15, 'token_based', NULL, NULL),
  (5, 'imagen-4.0-generate-00', 'image', 0, NULL, 0, 'per_image', 0.040000, 'image');
