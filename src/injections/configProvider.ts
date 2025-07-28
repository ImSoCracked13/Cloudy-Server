import { ElysiaConfig } from '../configs/framework/elysia.config';
import googleConfig from '../configs/feature/google.config';
import crypto from '../configs/feature/crypto.config';
import { db, initDatabase, pgTable, uuid, varchar, timestamp, boolean, integer, jsonb, eq, and, or, inArray, ilike, gt, isNull, sql, type InferSelectModel, type InferInsertModel } from '../configs/database/postgresql.config';
import { redis, connectToUpstashRedis } from '../configs/database/redis.config';
import { minioClient, initMinIO } from '../configs/storage/minio.config';

// Export database-related items for direct import by other modules
export { pgTable, uuid, varchar, timestamp, boolean, integer, jsonb, eq, and, or, inArray, ilike, gt, isNull, sql, type InferSelectModel, type InferInsertModel };

/**
 * Config Provider for Dependency Injection
 * This class manages all configuration files
 */
export class ConfigProvider {
  private static instance: ConfigProvider;

  private constructor() {}

  /**
   * Get the singleton instance of ConfigProvider
   */
  public static getInstance(): ConfigProvider {
    if (!ConfigProvider.instance) {
      ConfigProvider.instance = new ConfigProvider();
    }
    return ConfigProvider.instance;
  }

  /**
   * Get Elysia configuration
   */
  public getElysiaConfig(): typeof ElysiaConfig {
    return ElysiaConfig;
  }

  /**
   * Get Google configuration
   */
  public getGoogleConfig(): typeof googleConfig {
    return googleConfig;
  }

  /**
   * Get Crypto configuration
   */
  public getCryptoConfig(): typeof crypto {
    return crypto;
  }

  /**
   * Get PostgreSQL database
   */
  public getDatabase(): typeof db {
    return db;
  }

  /**
   * Initialize PostgreSQL database
   */
  public initDatabase(): Promise<boolean> {
    return initDatabase();
  }

  /**
   * Get Redis client
   */
  public getRedisClient(): typeof redis {
    return redis;
  }

  /**
   * Connect to Redis
   */
  public connectToRedis(): Promise<typeof redis> {
    return connectToUpstashRedis();
  }


  /**
   * Get MinIO client
   */
  public getMinioClient(): typeof minioClient {
    return minioClient;
  }

  /**
   * Initialize MinIO
   */
  public initMinIO(): Promise<boolean> {
    return initMinIO();
  }

  /**
   * Create a new Elysia app
   */
  public createApp(): any {
    return ElysiaConfig.createApp();
  }

  /**
   * Apply CORS to an Elysia app
   */
  public applyCors(app: any, corsConfig: any = {}): any {
    return ElysiaConfig.applyCors(app, corsConfig);
  }

  /**
   * Apply Cookie to an Elysia app
   */
  public applyCookie(app: any, cookieConfig: any = {}): any {
    return ElysiaConfig.applyCookie(app, cookieConfig);
  }

  /**
   * Apply JWT to an Elysia app
   */
  public applyJwt(app: any, secret: string): any {
    return ElysiaConfig.applyJwt(app, secret);
  }

  /**
   * Apply Swagger to an Elysia app
   */
  public applySwagger(app: any, options?: any): any {
    return ElysiaConfig.applySwagger(app, options);
  }

  /**
   * Apply all common middleware
   */
  public applyCommonMiddleware(app: any, configs: {
    corsConfig?: any,
    jwtSecret?: string,
    swaggerOptions?: any,
    cookieConfig?: any
  } = {}): any {
    return ElysiaConfig.applyCommonMiddleware(app, configs);
  }
}

// Export a singleton instance for easy access
export const configProvider = ConfigProvider.getInstance(); 