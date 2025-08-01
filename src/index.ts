import { configProvider } from './injections/configProvider';

import { schemaProvider } from './injections/schemaProvider';
import { repositoryProvider } from './injections/repositoryProvider';
import { serviceProvider } from './injections/serviceProvider';
import { controllerProvider } from './injections/controllerProvider';
import { routeProvider } from './injections/routeProvider';

import { middlewareProvider } from './injections/middlewareProvider';
import { utilityProvider } from './injections/utilityProvider';

const startup = async () => {
  const logger = utilityProvider.getLogger();
  logger.info('--- Initializing Services ---');
  
  // Initialize services in sequence
  try {
    // Initialize database connections (silently)
    await configProvider.initDatabase();
    await configProvider.connectToRedis();
    await configProvider.initMinIO();
    
    logger.info('--- Starting Web Server ---');

    // Initialize providers
    schemaProvider.resetSchemas();
    repositoryProvider.resetRepositories();
    utilityProvider.resetUtilities();
    serviceProvider.resetServices();
    controllerProvider.resetControllers();
    middlewareProvider.resetMiddlewares();
    routeProvider.resetRoutes();
    
    // Get server port
    const serverPort = parseInt(process.env.PORT || '3000', 10);

    // Create the app
    let app = configProvider.createApp();
    
    
    // Apply only essential middleware - JWT and Swagger
    const commonMiddleware = {
      // Swagger for API documentation
      swaggerOptions: {
        documentation: {
          info: {
            title: 'Cloudy API',
            version: '1.0.0',
            description: 'Cloud Storage API for Cloudy'
          },
          tags: [
            { name: 'Auth', description: 'Authentication endpoints' },
            { name: 'Files', description: 'File management endpoints' },
            { name: 'Users', description: 'User management endpoints' }
          ]
        },
        path: '/swagger'
      },
      
      // JWT is needed for authentication token generation
      jwtSecret: process.env.JWT_SECRET,
      
      // Currently cookie is not used and undeveloped, but can apply it for future use
      cookieConfig: {
      httpOnly: true,                                                     
      sameSite: process.env.NODE_ENV === 'production' ? 'Strict' : 'Lax', 
      maxAge: 60 * 60,                                                    
      path: '/',                                                         
      }
    };
    
    // Apply JWT and Swagger
    app = configProvider.getElysiaConfig().applySwagger(app, commonMiddleware.swaggerOptions);
    app = configProvider.getElysiaConfig().applyJwt(app, commonMiddleware.jwtSecret);
    app = configProvider.getElysiaConfig().applyCookie(app, commonMiddleware.cookieConfig);
    
    // Setup API routes
    routeProvider.setupApiRoutes(app);
    
    // Health check endpoint
    app.get('/health', () => ({ status: 'ok' }));
    
    // Start the server
    app.listen(serverPort, () => {
      logger.info(`🚀 Server running at http://localhost:${serverPort}`);
      logger.info(`📚 API documentation available at http://localhost:${serverPort}/swagger`);
    });

    // Check if server started successfully
    try {
      if (app.server) {
        logger.info('--- Server started successfully ---');
      }
    } catch (error) {
      logger.error('Error checking server status:', error);
    }

    // Export the app instance for testing
    return app;
  } catch (error) {
    logger.error('Failed to start server:', error);
    logger.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    if (error instanceof Error) {
      logger.error('Error message:', error.message);
      logger.error('Error stack:', error.stack);
    }
    process.exit(1);
  }
};

// Start the application
let app: any;
startup().then(appInstance => {
  app = appInstance;
}).catch(error => {
  const logger = utilityProvider.getLogger();
  logger.error('Unhandled startup error:', error);
  process.exit(1);
});

export type App = typeof app;