import { cors } from '@elysiajs/cors';
import { jwt } from '@elysiajs/jwt';
import { swagger } from '@elysiajs/swagger';
import { cookie } from '@elysiajs/cookie';

/**
 * Elysia framework configuration
 */
export class ElysiaConfig {
  /**
   * Get the default CORS configuration based on environment
   */
  static getDefaultCorsConfig() {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    return {
      origin: isDevelopment 
        ? ['http://localhost:3001']
        : ['https://cloudy-client-rho.vercel.app'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Content-Type', 
        'Authorization',
        'X-Requested-With',
        'Content-Length',
        'Accept',
        'Origin',
        'Cache-Control',
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Credentials',
        'Set-Cookie',
        'X-CSRF-Token'
      ],
      exposeHeaders: [
        'Content-Disposition',
        'Content-Length',
        'Content-Range',
        'Accept-Ranges',
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Credentials'
      ],
      credentials: true, // Allow cookies to be sent with requests
      maxAge: 3600, // 1 hour
      preflight: true,
      exposedHeaders: ['set-cookie']
    };
  }

  /**
   * Create a new Elysia instance
   */
  static createApp(): any {
    const { Elysia } = require('elysia');

    return new Elysia({
      parse: {
        json: true,
        cookie: true,
      },
      server: {
        port: process.env.PORT || 3000,
        hostname: process.env.HOST || 'localhost',
        idleTimeout: 300000,

        // Fly.io-specific: Disable proxy buffering
        headers: {
          'X-Accel-Buffering': 'no' // Critical for large uploads, for Fly.io if paid
        },
        // Increase request/response timeouts
        requestTimeout: 600 * 1000, // 10 minutes
        bodyTimeout: 600 * 1000,    // 10 minutes
      },
      // Use bodyParser but fly.io free tier cannot handle large uploads
      bodyParser: {
        limit: '500mb'
      }
    })
    .use(cors(this.getDefaultCorsConfig()));
  }

  /**
   * Apply CORS middleware with optional custom config
   */
  static applyCors(app: any, customConfig: any = {}): any {
    const config = {
      ...this.getDefaultCorsConfig(),
      ...customConfig
    };
    return app.use(cors(config));
  }

/**
 * Apply cookie middleware with secure defaults
 */
static applyCookie(app: any, cookieConfig: any = {}): any {
  const isProduction = process.env.NODE_ENV === 'production';
  const domain = isProduction ? 'https://cloudy-client-rho.vercel.app' : undefined;

  // This feature is currently experimental in Elysia, and not eligible for production in use and now completely useless
  const defaultCookieConfig = {
    name: 'jwt',                
    httpOnly: isProduction,     
    secure: isProduction,       
    sameSite: 'None',           
    maxAge: 60 * 60,            
    path: '/',                  
    domain,                     
    partitioned: isProduction,  
    priority: 'high'            
  };

  return app.use(
    cookie({
      ...defaultCookieConfig,
      ...cookieConfig,
    })
  );
}

  /**
   * Apply JWT middleware
   */
  static applyJwt(app: any, jwtSecret?: string): any {
    const secret = jwtSecret || process.env.JWT_SECRET;
    
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required but not set');
    }
    
    return app.use(jwt({
      name: 'jwt',
      secret: secret
    }));
  }

  /**
   * Apply Swagger documentation
   */
  static applySwagger(app: any, options?: any): any {
    const defaultOptions = {
      documentation: {
        info: {
          title: 'Cloudy API',
          version: '1.0.0',
          description: 'Cloud Storage API for Cloudy'
        }
      }
    };
    
    return app.use(swagger(options || defaultOptions));
  }

  /**
   * Apply all common middleware
   */
  static applyCommonMiddleware(app: any, configs: {
    corsConfig?: any,
    jwtSecret?: string,
    swaggerOptions?: any,
    cookieConfig?: any
  } = {}): any {
    // Apply middleware in the correct order
    app = ElysiaConfig.applyJwt(app, configs.jwtSecret);
    app = ElysiaConfig.applySwagger(app, configs.swaggerOptions);
    app = ElysiaConfig.applyCookie(app, configs.cookieConfig);
    
    return app;
  }
}
