import { configProvider } from '../injections/configProvider';
import { utilityProvider } from '../injections/utilityProvider';

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = 60 * 60; // 1 hour in seconds

// Validate JWT_SECRET exists
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required but not set');
}

// Create a JWT app using configProvider
const jwtApp = configProvider.applyJwt(configProvider.createApp(), JWT_SECRET);

export const generateToken = async (user: any): Promise<string> => {
  const logger = utilityProvider.getLogger();
  
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    authProvider: user.authProvider || 'local', // Include authProvider in token
    exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY
  };
  
  logger.info('Generating JWT token with payload:', {
    id: payload.id,
    email: payload.email,
    role: payload.role,
    authProvider: payload.authProvider,
    expiry: new Date(payload.exp * 1000).toISOString()
  });
  
  // Access the JWT plugin through the app's decorator
  const jwtHandler = (jwtApp as any).decorator.jwt;
  const token = await jwtHandler.sign(payload);
  
  return token;
};

export const verifyToken = async (token: string): Promise<any | null> => {
  const logger = utilityProvider.getLogger();
  
  try {
    // Access the JWT plugin through the app's decorator
    const jwtHandler = (jwtApp as any).decorator.jwt;
    const payload = await jwtHandler.verify(token);
    
    if (!payload || typeof payload === 'boolean') return null;
    
    // Verify the payload has the required properties
    if (!('id' in payload && 'email' in payload && 'role' in payload)) {
      return null;
    }
    
    // Redis validation is now handled by the service layer
    return {
      id: payload.id,
      email: payload.email,
      username: payload.username || '',
      role: payload.role,
      authProvider: payload.authProvider || 'local'
    };
  } catch (error) {
    logger.error('Token verification error:', error);
    return null;
  }
};

export const invalidateToken = async (userId: string): Promise<void> => {
  const logger = utilityProvider.getLogger();
  logger.debug(`Token invalidation request for user ${userId}`);
  try {
    // Invalidate the token by deleting it from Redis
    await configProvider.getRedisClient().del(`user:${userId}:token`);
    logger.info(`Token invalidated for user ${userId}`);
  } catch (error) {
    logger.error('Error invalidating token:', error);
  }
};

export default {
  generateToken,
  verifyToken,
  invalidateToken,
}; 