import crypto from 'crypto';

export interface UserPayload {
  user_id: number;
  email: string;
  name: string;
  credits: number;
  function_code: string;
  timestamp: number;
  exp: number;
}

export interface SyncPayload {
  email: string;
  name: string;
  password?: string;
  credits: number;
  domain_url?: string;
  timestamp: number;
  phone_number?: string;
  birthday?: string;
}

export interface SsoPayload {
  user_id: number;
  email: string;
  name: string;
  credits: number;
  function_code: string;
  timestamp: number;
  exp: number;
  password?: string;
  domain_url?: string;
}

interface PlatformConfig {
  token_type: 'hmac' | 'aes';
  secret_key: string;
  hmac_secret?: string;
}

export class StudyWithAITokenService {
  private platforms: Map<string, PlatformConfig> = new Map();

  constructor() {
    this.initializePlatforms();
  }

  private initializePlatforms(): void {
    // Study with AI platform (AES - based on actual token analysis)
    this.platforms.set('study_with_ai', {
      token_type: 'aes',
      secret_key: process.env.STUDY_WITH_AI_SECRET_KEY || process.env.JWT_SECRET!,
      hmac_secret: process.env.STUDY_WITH_AI_HMAC_SECRET || process.env.JWT_SECRET!
    });

    // Career Guidance platform (AES)
    this.platforms.set('career_guidance', {
      token_type: 'aes',
      secret_key: process.env.CAREER_GUIDANCE_SECRET_KEY || process.env.JWT_SECRET!,
      hmac_secret: process.env.CAREER_GUIDANCE_HMAC_SECRET || process.env.JWT_SECRET!
    });

    // BGTT platform (existing SSO - HMAC)
    this.platforms.set('bgtt', {
      token_type: 'hmac',
      secret_key: process.env.SSO_SECRET || process.env.JWT_SECRET!,
      hmac_secret: process.env.SSO_SECRET || process.env.JWT_SECRET!  // Use same secret for HMAC
    });
  }

  /**
   * Verify SSO token (supports both HMAC and AES)
   */
  verifySsoToken(token: string, platformCode: string = 'study_with_ai'): SsoPayload | null {
    try {
      const platform = this.platforms.get(platformCode);
      if (!platform) {
        throw new Error(`Platform ${platformCode} not configured`);
      }

      let payload: SsoPayload;

      if (platform.token_type === 'aes') {
        payload = this.decryptAesToken(token, platform.secret_key);
      } else {
        payload = this.verifyHmacToken(token, platform.hmac_secret || platform.secret_key);
      }

      this.validateSsoPayload(payload);
      return payload;
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }

  /**
   * Verify SSO token cross-platform.
   * - sourcePlatform: platform gửi token (quyết định token_type / algorithm)
   * - targetPlatform: platform nhận token (quyết định secret key để verify/decrypt)
   */
  verifySsoTokenCrossPlatform(
    token: string,
    sourcePlatform: string,
    targetPlatform: string = 'study_with_ai'
  ): SsoPayload | null {
    try {
      const target = this.platforms.get(targetPlatform);

      if (!target) {
        throw new Error(`Target platform ${targetPlatform} not configured`);
      }

      const tokenType = target.token_type;
      const secretKey = target.secret_key;
      const hmacSecret = target.hmac_secret || target.secret_key;

      let payload: SsoPayload;

      if (tokenType === 'aes') {
        payload = this.decryptAesToken(token, secretKey);
      } else {
        payload = this.verifyHmacToken(token, hmacSecret);
      }

      this.validateSsoPayload(payload);
      return payload;
    } catch (error) {
      console.error('Cross-platform token verification failed:', error);
      return null;
    }
  }

  /**
   * Verify sync token (supports both HMAC and AES)
   */
  verifySyncToken(token: string, platformCode: string = 'study_with_ai'): SyncPayload | null {
    try {
      const platform = this.platforms.get(platformCode);
      if (!platform) {
        throw new Error(`Platform ${platformCode} not configured`);
      }

      let payload: SyncPayload;

      if (platform.token_type === 'aes') {
        payload = this.decryptAesToken(token, platform.secret_key);
      } else {
        payload = this.verifyHmacToken(token, platform.hmac_secret || platform.secret_key);
      }

      this.validateSyncPayload(payload);
      return payload;
    } catch (error) {
      console.error('Sync token verification failed:', error);
      return null;
    }
  }

  /**
   * Verify HMAC token
   */
  private verifyHmacToken<T>(token: string, secretKey: string): T {
    const [payloadBase64, signature] = token.split('.');
    
    if (!payloadBase64 || !signature) {
      throw new Error('Invalid token format');
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(payloadBase64)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new Error('Invalid token signature');
    }

    // Decode payload
    const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
    return JSON.parse(payloadJson) as T;
  }

  /**
   * Decrypt AES token (matches EXACT PHP implementation)
   * Based on the exact PHP code provided by Study with AI
   */
  private decryptAesToken(token: string, secretKey: string): SsoPayload {
    try {
      // Decode URL-encoded token (handle cases where token is double-encoded or has special characters)
      let processedToken = token;
      if (token.includes('%')) {
        processedToken = decodeURIComponent(token);
      }

      // Decode base64 - EXACT same as PHP: base64_decode($token)
      const encryptedData = Buffer.from(processedToken, 'base64');
      
      if (encryptedData.length < 16) {
        throw new Error('Invalid token format: too short for AES');
      }

      // Extract IV (first 16 bytes) - EXACT same as PHP: substr($decoded, 0, 16)
      const iv = encryptedData.slice(0, 16);
      // Extract ciphertext (remaining bytes) - EXACT same as PHP: substr($decoded, 16)
      const ciphertext = encryptedData.slice(16);

      // Try both key derivation methods based on PHP logs
      const methods = [
        {
          name: 'AES-256-CBC with full SHA256 hash',
          derive: (secret) => {
            const fullHash = crypto.createHash('sha256').update(secret).digest('hex');
            return Buffer.from(fullHash, 'hex'); // 32 bytes
          },
          algorithm: 'aes-256-cbc'
        },
        {
          name: 'AES-128-CBC with substr 32 (PHP style)',
          derive: (secret) => {
            const keyHex = crypto.createHash('sha256').update(secret).digest('hex').substring(0, 32);
            return Buffer.from(keyHex, 'hex'); // 16 bytes
          },
          algorithm: 'aes-128-cbc'
        }
      ];
      
      for (const method of methods) {
        try {
          const key = method.derive(secretKey);
          const decipher = crypto.createDecipheriv(method.algorithm, key, iv);
          decipher.setAutoPadding(true); // PHP uses default padding
          
          let decrypted = decipher.update(ciphertext);
          decrypted = Buffer.concat([decrypted, decipher.final()]);

          const payloadJson = decrypted.toString('utf8');
          const rawPayload = JSON.parse(payloadJson);

          // Ensure all fields are included in the returned payload
          const payload: SsoPayload = {
            user_id: rawPayload.user_id,
            email: rawPayload.email,
            name: rawPayload.name,
            credits: rawPayload.credits,
            function_code: rawPayload.function_code,
            timestamp: rawPayload.timestamp,
            exp: rawPayload.exp,
            password: rawPayload.password,
            domain_url: rawPayload.domain_url
          };

          return payload;
        } catch (error) {
          // Continue to next method
        }
      }

      throw new Error('All decryption methods failed');
    } catch (error: any) {
      console.error('AES decryption failed:', error.message);
      throw new Error(`AES decryption failed: ${error.message}`);
    }
  }

  /**
   * Validate SSO payload for authentication
   */
  private validateSsoPayload(payload: SsoPayload): void {
    if (!payload.user_id || !payload.email || !payload.name) {
      throw new Error('Missing required fields in SSO payload');
    }

    if (!payload.timestamp || !payload.exp) {
      throw new Error('Missing timestamp fields');
    }

    // Check expiration
    if (Date.now() / 1000 > payload.exp) {
      throw new Error('Token expired');
    }

    // Check timestamp (prevent old tokens)
    const maxAge = 300; // 5 minutes
    if (Date.now() / 1000 - payload.timestamp > maxAge) {
      throw new Error('Token too old');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email)) {
      throw new Error('Invalid email format');
    }

    // Validate credits is number
    if (typeof payload.credits !== 'number') {
      throw new Error('Credits must be a number');
    }
  }

  /**
   * Validate sync payload
   */
  private validateSyncPayload(payload: SyncPayload): void {
    if (!payload.email || !payload.name) {
      throw new Error('Missing required fields in sync payload');
    }

    if (!payload.timestamp) {
      throw new Error('Missing timestamp');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email)) {
      throw new Error('Invalid email format');
    }

    // Validate credits is number
    if (typeof payload.credits !== 'number') {
      throw new Error('Credits must be a number');
    }
  }

  /**
   * Add or update platform configuration
   */
  addPlatform(platformCode: string, config: PlatformConfig): void {
    this.platforms.set(platformCode, config);
  }

  /**
   * Get platform configuration
   */
  getPlatform(platformCode: string): PlatformConfig | undefined {
    return this.platforms.get(platformCode);
  }

  /**
   * Get all configured platforms
   */
  getAllPlatforms(): Map<string, PlatformConfig> {
    return new Map(this.platforms);
  }
}
