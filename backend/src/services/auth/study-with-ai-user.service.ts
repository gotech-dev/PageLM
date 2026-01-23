import { query, queryOne } from '../../utils/database/mysql';
import { randomUUID } from 'crypto';
import { SyncPayload, SsoPayload } from './study-with-ai-token.service';

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  birth_date: string | null;
  credits: number;
  password: string | null;
  domain_url: string | null;
  external_platform_id: number | null;
  source_platform: string | null;
  created_at: Date;
  updated_at: Date;
}

interface PlatformRow {
  id: number;
  platform_code: string;
  name: string;
  api_url: string;
  secret_key: string;
  sync_endpoint: string;
  sso_endpoint: string;
  token_type: 'hmac' | 'aes';
  hmac_secret: string | null;
  use_function_code_in_url: boolean;
  function_codes: string | null;
  default_redirect: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface UserPlatformRow {
  id: number;
  user_id: string;
  external_platform_id: number;
  is_origin: boolean;
  redirected_at: Date | null;
  last_synced_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class StudyWithAIUserService {
  /**
   * Sync user data from main platform to Study with AI
   */
  async syncUser(payload: SyncPayload, platformCode?: string): Promise<UserRow> {
    // Check if user exists by email or phone
    let existingUser: UserRow | null = null;
    
    if (payload.phone_number) {
      const cleanPhone = payload.phone_number.trim().replace(/\s/g, '');
      existingUser = await this.findByPhone(cleanPhone);
    }
    
    if (!existingUser && payload.email) {
      existingUser = await this.findByEmail(payload.email);
    }

    // Get platform information
    const platformId = platformCode ? await this.getPlatformId(platformCode) : null;

    if (existingUser) {
      // Handle existing user logic
      const existingPlatformId = existingUser.external_platform_id;
      const newPlatformId = platformId;

      if (existingPlatformId !== newPlatformId && newPlatformId !== null) {
        // User exists but from different platform → create new user
        console.log(`[UserSync] User exists with different platform: ${existingPlatformId} → ${newPlatformId}, creating new user`);

        const newUser = await this.create({
          name: payload.name,
          email: payload.email,
          phone: payload.phone_number ? payload.phone_number.trim().replace(/\s/g, '') : null,
          birth_date: payload.birthday || null,
          credits: payload.credits,
          password: payload.password || null,
          domain_url: payload.domain_url || null,
          external_platform_id: newPlatformId,
          source_platform: platformCode || null
        });

        // Track platform relationship
        if (platformCode) {
          await this.trackPlatformRelationship(newUser.id, platformCode, true);
        }

        return newUser;
      } else {
        // Same platform → update existing user
        console.log(`[UserSync] Updating existing user (same platform): ${existingUser.id}`);

        const updatedUser = await this.update(existingUser.id, {
          name: payload.name,
          phone: payload.phone_number ? payload.phone_number.trim().replace(/\s/g, '') : existingUser.phone,
          birth_date: payload.birthday || existingUser.birth_date,
          credits: payload.credits,
          password: payload.password || existingUser.password,
          domain_url: payload.domain_url || existingUser.domain_url,
          external_platform_id: existingPlatformId || newPlatformId,
          source_platform: existingUser.source_platform || platformCode
        });

        // Track platform relationship if not already tracked
        if (newPlatformId && platformCode) {
          await this.trackPlatformRelationship(existingUser.id, platformCode, false);
        }

        return updatedUser;
      }
    } else {
      // Create new user
      console.log(`[UserSync] Creating new user with platform: ${platformCode}`);

      const newUser = await this.create({
        name: payload.name,
        email: payload.email,
        phone: payload.phone_number ? payload.phone_number.trim().replace(/\s/g, '') : null,
        birth_date: payload.birthday || null,
        credits: payload.credits,
        password: payload.password || null,
        domain_url: payload.domain_url || null,
        external_platform_id: platformId,
        source_platform: platformCode || null
      });

      // Track platform relationship - this is the origin platform
      if (platformCode) {
        await this.trackPlatformRelationship(newUser.id, platformCode, true);
      }

      return newUser;
    }
  }

  /**
   * Authenticate user via SSO token
   */
  async authenticateUser(payload: SsoPayload, platformCode?: string): Promise<UserRow> {
    // Find user by email
    let user = await this.findByEmail(payload.email);
    
    if (!user) {
      // Create new user from SSO token
      console.log(`[Auth] Creating new user: ${payload.email}, credits: ${payload.credits}`);
      const newUser = await this.create({
        name: payload.name,
        email: payload.email,
        credits: payload.credits,
        password: payload.password || null,
        domain_url: payload.domain_url || null,
        source_platform: platformCode || null
      });
      
      console.log(`[Auth] Created new user with ID: ${newUser.id}, credits: ${newUser.credits}, hasPassword: ${!!newUser.password}`);
      
      // Track platform relationship - user comes from external platform (not origin)
      if (platformCode) {
        await this.trackPlatformRelationship(newUser.id, platformCode, false);
      }
      
      return newUser;
    }
    
    console.log(`[Auth] Found existing user: ${user.id}, current credits: ${user.credits}, hasPassword: ${!!user.password}`);
    console.log(`[Auth] Updating with payload credits: ${payload.credits}, hasPassword: ${!!payload.password}`);
    
    // Update user data from SSO token
    const updatedUser = await this.update(user.id, {
      name: payload.name,
      credits: payload.credits,
      password: payload.password || user.password,
      domain_url: payload.domain_url || user.domain_url
    });
    
    console.log(`[Auth] Updated user credits: ${updatedUser.credits}, hasPassword: ${!!updatedUser.password}`);
    
    // Track platform relationship if not already tracked
    if (platformCode) {
      await this.trackPlatformRelationship(user.id, platformCode, false);
    }
    
    return updatedUser;
  }

  /**
   * Create a new user
   */
  private async create(userData: Partial<UserRow>): Promise<UserRow> {
    const userId = randomUUID();
    const now = new Date();

    await query(
      `INSERT INTO users (
        id, name, email, phone, birth_date, credits, password, 
        domain_url, external_platform_id, source_platform, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        userData.name,
        userData.email,
        userData.phone || null,
        userData.birth_date || null,
        userData.credits || 0,
        userData.password || null,
        userData.domain_url || null,
        userData.external_platform_id || null,
        userData.source_platform || null,
        now,
        now
      ]
    );

    const newUser = await this.findById(userId);
    if (!newUser) {
      throw new Error('Failed to create user');
    }

    return newUser;
  }

  /**
   * Update user data
   */
  private async update(userId: string, userData: Partial<UserRow>): Promise<UserRow> {
    const now = new Date();
    
    // Convert undefined values to null for MySQL compatibility
    const params = [
      userData.name ?? null,
      userData.phone ?? null,
      userData.birth_date ?? null,
      userData.credits ?? null,
      userData.password ?? null,
      userData.domain_url ?? null,
      userData.external_platform_id ?? null,
      userData.source_platform ?? null,
      now,
      userId
    ];
    
    await query(
      `UPDATE users SET 
        name = ?, phone = ?, birth_date = ?, credits = ?, 
        password = ?, domain_url = ?, external_platform_id = ?, 
        source_platform = ?, updated_at = ?
      WHERE id = ?`,
      params
    );

    const updatedUser = await this.findById(userId);
    if (!updatedUser) {
      throw new Error('Failed to update user');
    }

    return updatedUser;
  }

  /**
   * Find user by ID
   */
  async findById(userId: string): Promise<UserRow | null> {
    return queryOne<UserRow>(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<UserRow | null> {
    return queryOne<UserRow>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
  }

  /**
   * Find user by phone
   */
  async findByPhone(phone: string): Promise<UserRow | null> {
    return queryOne<UserRow>(
      'SELECT * FROM users WHERE phone = ?',
      [phone]
    );
  }

  /**
   * Get platform ID by platform code
   */
  async getPlatformId(platformCode: string): Promise<number | null> {
    const platform = await queryOne<PlatformRow>(
      'SELECT id FROM external_platforms WHERE platform_code = ? AND is_active = TRUE',
      [platformCode]
    );
    
    return platform?.id || null;
  }

  /**
   * Track platform relationship for a user
   */
  private async trackPlatformRelationship(userId: string, platformCode: string, isOrigin: boolean): Promise<void> {
    // Get platform ID
    const platform = await queryOne<PlatformRow>(
      'SELECT id FROM external_platforms WHERE platform_code = ? AND is_active = TRUE',
      [platformCode]
    );
    
    if (!platform) {
      console.warn(`[UserSync] Platform not found: ${platformCode}`);
      return;
    }

    // Check if relationship already exists
    const existing = await queryOne<UserPlatformRow>(
      'SELECT * FROM user_platforms WHERE user_id = ? AND external_platform_id = ?',
      [userId, platform.id]
    );

    if (existing) {
      // Update existing relationship
      await query(
        `UPDATE user_platforms SET 
          is_origin = ?, redirected_at = ?, last_synced_at = ?, updated_at = ?
        WHERE id = ?`,
        [
          isOrigin || existing.is_origin,
          isOrigin ? null : new Date(),
          new Date(),
          new Date(),
          existing.id
        ]
      );
    } else {
      // Create new relationship
      await query(
        `INSERT INTO user_platforms (
          user_id, external_platform_id, is_origin, redirected_at, 
          last_synced_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          platform.id,
          isOrigin,
          isOrigin ? null : new Date(),
          new Date(),
          new Date(),
          new Date()
        ]
      );
    }
  }

  /**
   * Get user's platform relationships
   */
  async getUserPlatforms(userId: string): Promise<Array<UserRow & PlatformRow & UserPlatformRow>> {
    return await query(
      `SELECT u.*, ep.platform_code, ep.name as platform_name, ep.api_url,
         up.is_origin, up.redirected_at, up.last_synced_at
      FROM users u
      JOIN user_platforms up ON u.id = up.user_id
      JOIN external_platforms ep ON up.external_platform_id = ep.id
      WHERE u.id = ?
      ORDER BY up.is_origin DESC, up.redirected_at DESC`,
      [userId]
    );
  }

  /**
   * Get user's origin platform
   */
  async getOriginPlatform(userId: string): Promise<PlatformRow | null> {
    const result = await query<PlatformRow>(
      `SELECT ep.*
      FROM external_platforms ep
      JOIN user_platforms up ON ep.id = up.external_platform_id
      WHERE up.user_id = ? AND up.is_origin = TRUE
      LIMIT 1`,
      [userId]
    );
    
    return result[0] || null;
  }

  /**
   * Format birth date for consistent output
   */
  formatBirthDate(birthDate: any): string | null {
    if (!birthDate) return null;

    if (birthDate instanceof Date) {
      const year = birthDate.getFullYear();
      const month = String(birthDate.getMonth() + 1).padStart(2, '0');
      const day = String(birthDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } else if (typeof birthDate === 'string') {
      if (birthDate.includes('T')) {
        return birthDate.split('T')[0];
      } else {
        return birthDate;
      }
    } else {
      return String(birthDate);
    }
  }
}
