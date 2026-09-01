import { StudyWithAITokenService } from '../../services/auth/study-with-ai-token.service';
import { StudyWithAIUserService } from '../../services/auth/study-with-ai-user.service';
import jwt from 'jsonwebtoken';

const JWT_SECRET: string = process.env.JWT_SECRET!;
const JWT_ISSUER = process.env.JWT_ISSUER || 'pagelm';

// Simple inline helpers to avoid missing imports
function createRequestContext(): string {
  return Math.random().toString(36).substring(2, 15);
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenError';
  }
}

class StudyWithAIError extends Error {
  constructor(message: string, public statusCode: number = 500, public code?: string) {
    super(message);
    this.name = 'StudyWithAIError';
  }
}

function handleStudyWithAIError(error: any, requestId: string): { statusCode: number; message: string } {
  console.error(`[${requestId}] SSO Error:`, error);
  if (error instanceof ValidationError) return { statusCode: 400, message: error.message };
  if (error instanceof TokenError) return { statusCode: 401, message: error.message };
  if (error instanceof StudyWithAIError) return { statusCode: error.statusCode, message: error.message };
  return { statusCode: 500, message: 'Internal server error' };
}

const logger = {
  debug: (msg: string, ctx?: any) => console.log(`[DEBUG] ${msg}`, ctx || ''),
  info: (msg: string, ctx?: any) => console.log(`[INFO] ${msg}`, ctx || ''),
  error: (msg: string, ctx?: any) => console.error(`[ERROR] ${msg}`, ctx || ''),
  logSSOAuthentication: (requestId: string, email: string, platform: string, path: string) => {
    console.log(`[SSO] Authentication success`, { requestId, email, platform, path });
  }
};

export function studyWithAISyncRoutes(app: any) {

    // Token processing endpoint
    app.post('/api/syncUser', async (req: any, res: any) => {
        const requestId = createRequestContext();
        // Initialize services
        const tokenService = new StudyWithAITokenService();
        const userService = new StudyWithAIUserService();

        try {
            // Parse request body
            const { token, platform_code = 'study_with_ai' } = req.body;

            if (!token) {
                throw new ValidationError('Token không tồn tại');
            }

            // Handle URL-encoded tokens (from query parameters)
            let processedToken = token;
            try {
                if (token.includes('%')) {
                    processedToken = decodeURIComponent(token);
                }
            } catch (decodeError: any) {
                console.warn('URL decode warning', { error: decodeError.message });
            }

            // Verify and decrypt token
            let userData: any;
            try {
                userData = tokenService.verifySyncToken(processedToken, platform_code);
                if (!userData) {
                    throw new TokenError('Token verification failed');
                }
            } catch (decryptError: any) {
                throw new TokenError('Token không hợp lệ hoặc đã hết hạn');
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(userData.email)) {
                throw new ValidationError('Email không hợp lệ');
            }

            // Format phone number if provided
            const cleanPhone = userData.phone_number ? userData.phone_number.trim().replace(/\s/g, '') : null;
            if (userData.phone_number && !cleanPhone) {
                console.warn('Invalid phone format', { phone: userData.phone_number });
            }

            // Format birthday if provided
            const birthDate = userData.birthday ? new Date(userData.birthday).toISOString().split('T')[0] : null;
            if (userData.birthday && !birthDate) {
                console.warn('Invalid date format', { birthday: userData.birthday });
            }

            // Sync user
            const syncedUser = await userService.syncUser({
                ...userData,
                phone_number: cleanPhone || undefined,
                birthday: birthDate || undefined
            }, platform_code || 'study_with_ai');

            const birthDateFormatted = userService.formatBirthDate(syncedUser.birth_date);

            console.log('User synced successfully', { userId: syncedUser.id, email: syncedUser.email });

            return res.json({
                success: true,
                user: {
                    id: syncedUser.id,
                    name: syncedUser.name,
                    email: syncedUser.email,
                    phone: syncedUser.phone,
                    birthDate: birthDateFormatted,
                    credits: Number(syncedUser.credits),
                    externalPlatformId: syncedUser.external_platform_id,
                    sourcePlatform: syncedUser.source_platform
                },
                message: syncedUser.source_platform === platform_code ? 
                    'Thông tin đã được cập nhật thành công' : 
                    'Tài khoản đã được tạo từ platform khác'
            });

        } catch (error: any) {
            const { statusCode, message } = handleStudyWithAIError(error, requestId);
            return res.status(statusCode).json({ error: message });
        }
    });

    // Direct SSO endpoint for Study with AI (handles frontend redirect)
    app.get('/auth/sso', async (req: any, res: any) => {
        const requestId = createRequestContext();

        const tokenService = new StudyWithAITokenService();
        const userService = new StudyWithAIUserService();

        try {
            const {
                token,
                function_code,
                redirect,
                source_platform = 'bgtt',
                target_platform = 'study_with_ai',
                platform_code
            } = req.query;

            if (!token) {
                throw new ValidationError('Token is required');
            }

            const resolvedSourcePlatform = source_platform || platform_code || 'bgtt';
            const resolvedTargetPlatform = target_platform || 'study_with_ai';

            logger.debug('Processing direct SSO token', {
                requestId,
                source_platform: resolvedSourcePlatform,
                target_platform: resolvedTargetPlatform
            });

            // Verify token
            const payload = tokenService.verifySsoTokenCrossPlatform(
                token,
                resolvedSourcePlatform,
                resolvedTargetPlatform
            );
            if (!payload) {
                throw new TokenError('Invalid token');
            }

            logger.debug('Token verified successfully', { requestId, email: payload.email });

            // Ensure domain_url is set to partner's domain if not present in token
            if (!payload.domain_url) {
                const referer = req.headers.referer || req.headers.origin;
                if (referer && typeof referer === 'string') {
                    try {
                        const url = new URL(referer);
                        payload.domain_url = `${url.protocol}//${url.host}`;
                        logger.debug('Set domain_url from referer', { requestId, domain_url: payload.domain_url });
                    } catch (e) {
                        console.warn('Invalid referer URL', { requestId, referer });
                    }
                }
            }

            // Authenticate user
            const user = await userService.authenticateUser(payload, resolvedSourcePlatform);
            
            if (!user) {
                throw new StudyWithAIError('Authentication failed', 500, 'Authentication failed');
            }

            logger.debug('User authenticated', { 
                requestId, 
                userId: user.id, 
                email: user.email,
                credits: user.credits,
                hasPassword: !!user.password
            });

            // Generate JWT token
            const jwtToken = jwt.sign(
                {
                    sub: user.id,
                    userId: user.id,
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    credits: user.credits,
                    iss: JWT_ISSUER,
                    sso: true,
                    source: resolvedSourcePlatform
                },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            // Determine redirect path
            let redirectPath = '/'; // default
            if (redirect) {
                redirectPath = redirect;
            } else if (function_code) {
                // Map function codes to paths
                const functionRoutes: Record<string, string> = {
                    '1': '/',
                    '2': '/planner',
                    '3': '/tools',
                    '4': '/chat'
                };
                redirectPath = functionRoutes[function_code] || '/';
            }

            logger.logSSOAuthentication(requestId, user.email, resolvedSourcePlatform, redirectPath);

            // Redirect to frontend with token
            const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'http://localhost:5174';
            const redirectUrl = `${frontendUrl}/?token=${encodeURIComponent(jwtToken)}&redirect=${encodeURIComponent(redirectPath)}`;

            logger.debug('Redirecting to frontend', { requestId, redirectUrl });

            // Manual redirect since res.redirect may not exist
            res.writeHead(302, { Location: redirectUrl });
            res.end();

        } catch (error: any) {
            const { statusCode, message } = handleStudyWithAIError(error, requestId);
            return res.status(statusCode).json({ error: message });
        }
    });

    // Enhanced SSO authentication endpoint
    app.get('/auth/sso-study-with-ai', async (req: any, res: any) => {
        const requestId = createRequestContext();
        logger.info('GET Study with AI SSO authentication', { requestId });

        const tokenService = new StudyWithAITokenService();
        const userService = new StudyWithAIUserService();

        try {
            const { token, function_code, redirect, platform_code = 'study_with_ai' } = req.query;

            if (!token) {
                throw new ValidationError('Token is required');
            }

            // Verify token
            const payload = tokenService.verifySsoToken(token, platform_code);
            if (!payload) {
                throw new TokenError('Invalid token');
            }

            // Ensure domain_url is set to partner's domain if not present in token
            if (!payload.domain_url) {
                const referer = req.headers.referer || req.headers.origin;
                if (referer && typeof referer === 'string') {
                    try {
                        const url = new URL(referer);
                        payload.domain_url = `${url.protocol}//${url.host}`;
                        logger.debug('Set domain_url from referer', { requestId, domain_url: payload.domain_url });
                    } catch (e) {
                        console.warn('Invalid referer URL', { requestId, referer });
                    }
                }
            }

            // Authenticate user
            const user = await userService.authenticateUser(payload, platform_code);
            
            if (!user) {
                throw new StudyWithAIError('Authentication failed', 500, 'Authentication failed');
            }

            // Generate JWT token
            const jwtToken = jwt.sign(
                {
                    sub: user.id,
                    userId: user.id,
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    credits: user.credits,
                    iss: JWT_ISSUER,
                    sso: true,
                    source: platform_code
                },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            // Determine redirect path
            let redirectPath = '/'; // default
            if (redirect) {
                redirectPath = redirect;
            } else if (function_code) {
                // Map function codes to paths
                const functionRoutes: Record<string, string> = {
                    '1': '/',
                    '2': '/planner',
                    '3': '/tools',
                    '4': '/chat'
                };
                redirectPath = functionRoutes[function_code] || '/';
            }

            logger.logSSOAuthentication(requestId, user.email, platform_code, redirectPath);

            // Redirect to frontend with token
            const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'http://localhost:5174';
            const redirectUrl = `${frontendUrl}/?token=${encodeURIComponent(jwtToken)}&redirect=${encodeURIComponent(redirectPath)}`;

            logger.debug('Redirecting to frontend', { requestId, redirectUrl });

            // Manual redirect since res.redirect may not exist
            res.writeHead(302, { Location: redirectUrl });
            res.end();

        } catch (error: any) {
            const { statusCode, message } = handleStudyWithAIError(error, requestId);
            return res.status(statusCode).json({ error: message });
        }
    });
}
