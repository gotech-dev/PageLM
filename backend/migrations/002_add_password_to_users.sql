ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL;

-- Update existing users with hashed passwords
UPDATE users SET password = '$2b$10$kGb3lKmNjFyiNlQ896Pce.2rFXHPNgPLVGCdCWc4/tMMD0TWOoFr.' WHERE email = 'gotechjsc@gmail.com';
UPDATE users SET password = '$2b$10$ktaWo1MNRrxvMYOjHDppiOycl499WWi0wgZbSq9ch8aIU1SMgvbZe' WHERE email = 'test@pagelm.com';
