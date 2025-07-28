import { configProvider } from '../injections/configProvider';
import { utilityProvider } from '../injections/utilityProvider';

const EMAIL_VERIFICATION_EXPIRY = 60 * 60; // 1 hour in seconds
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001' || 'https://cloudy-client-rho.vercel.app';

/**
 * EmailHandler class for managing all email-related functionality
 */
export class EmailHandler {
  private static instance: EmailHandler;
  private logger: any;
  private redis: any;
  private crypto: any;
  private initialized = false;

  private constructor() {
    // Empty constructor to prevent direct instantiation
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): EmailHandler {
    if (!EmailHandler.instance) {
      EmailHandler.instance = new EmailHandler();
    }
    return EmailHandler.instance;
  }

  /**
   * Initialize dependencies after instance creation
   */
  public async init(): Promise<void> {
    if (!this.initialized) {
      this.logger = utilityProvider.getLogger();
      this.redis = configProvider.getRedisClient();
      this.crypto = configProvider.getCryptoConfig();
      
      // Test Redis connection
      try {
        await this.redis.ping();
        this.logger.info('EmailHandler: Redis connection verified');
      } catch (error) {
        this.logger.error('EmailHandler: Redis connection failed:', error);
      }
      
      this.initialized = true;
    }
  }

  /**
   * Generate a secure custom email verification token with crypto's custom tokens, this is different from the JWTs
   */
  async generateVerificationToken(): Promise<string> {
    if (!this.initialized) await this.init();
    if (!this.crypto?.generateVerificationToken) {
      throw new Error('Crypto configuration not properly initialized');
    }
    return this.crypto.generateVerificationToken();
  }

  /**
   * Send verification email to user
   */
  async sendVerificationEmail(email: string, token: string): Promise<boolean> {
    if (!this.initialized) await this.init();
    try {
      this.logger.info(`Sending verification email to ${email}`);
      
      // Build the verification URL for the email
      const verificationUrl = `${FRONTEND_URL}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
      
      // Store the token in Redis
      await this.storeVerificationToken(token, email);
      
      // Log the verification URL for debugging
      this.logger.info(`Verification URL for ${email}: ${verificationUrl}`);
      
      return true;
    } catch (error) {
      this.logger.error('Failed to send verification email:', error);
      return false;
    }
  }

  /**
   * Store a verification token in Redis
   */
  async storeVerificationToken(token: string, email: string): Promise<void> {
    if (!this.initialized) await this.init();
    try {
      // Check if Redis client is available
      if (!this.redis) {
        this.logger.error('Redis client not initialized');
        return;
      }

      // Test Redis connection before storing
      await this.redis.ping();
      
      // Store the token with expiry using Upstash Redis syntax
      const result = await this.redis.set(`verification:${token}`, email, { ex: EMAIL_VERIFICATION_EXPIRY });
      this.logger.info(`Verification token stored in Redis for email: ${email}, result: ${result}`);
    } catch (error) {
      this.logger.error('Failed to store verification token:', {
        error: error instanceof Error ? error.message : error,
        token: token.substring(0, 10) + '...',
        email: email
      });
    }
  }
}

// Create and export a singleton instance
export const emailHandler = EmailHandler.getInstance(); 