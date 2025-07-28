declare global {
  
  // Google OAuth related types
  interface GoogleUser {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
    locale?: string;
  }
} 

declare namespace JWT {
  interface Payload {
    id: string;
    email: string;
  }
}

declare namespace Express {
  interface Request {
    user?: JWT.Payload;
  }
}

// Extend Elysia's context type
declare module 'elysia' {
  interface Context {
    user: JWT.Payload;
  }
  
  interface Set {
    headers: Record<string, string>;
  }
} 

// Environment variable types
declare namespace NodeJS {
  interface ProcessEnv {
    PORT?: string;
    REDIS_HOST?: string;
    REDIS_PORT?: string;
    REDIS_PASSWORD?: string;
    JWT_SECRET?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    MINIO_ENDPOINT?: string;
    MINIO_PORT?: string;
    MINIO_USE_SSL?: string;
    MINIO_ACCESS_KEY?: string;
    MINIO_SECRET_KEY?: string;
    MINIO_BUCKET_NAME?: string;
    RATE_LIMIT_MAX_REQUESTS?: string;
    ALLOWED_ORIGINS?: string;
  }
} 