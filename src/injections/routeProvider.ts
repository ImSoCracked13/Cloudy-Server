import { userRoute } from '../routes/userRoute';
import { fileRoute } from '../routes/fileRoute';

/**
 * Route Provider for Dependency Injection
 * This class manages all route configurations
 */
export class RouteProvider {
  private static instance: RouteProvider;

  private constructor() {}

  /**
   * Get the singleton instance of RouteProvider
   */
  public static getInstance(): RouteProvider {
    if (!RouteProvider.instance) {
      RouteProvider.instance = new RouteProvider();
    }
    return RouteProvider.instance;
  }

  /**
   * Get Elysia configuration
   */
  public getElysiaConfig(): any {
    // This will need to be imported directly or provided through another mechanism to avoid circular dependencies
    return require('../configs/framework/elysia.config');
  }

  /**
   * Get user routes
   */
  public getUserRoutes(): typeof userRoute {
    return userRoute;
  }

  /**
   * Get file routes
   */
  public getFileRoutes(): typeof fileRoute {
    return fileRoute;
  }

  /**
   * Setup all API routes
   */
  public setupApiRoutes(app: any): any {
    // Group routes without additional CORS handling
    return app.group('/api', (app: any) => app
      .group('/users', (app: any) => userRoute(app))
      .group('/files', (app: any) => fileRoute(app))
    );
  }

  /**
   * Reset routes (useful for testing)
   */
  public resetRoutes(): void {
    // Reset any stateful routes if needed
  }
}

// Export a singleton instance for easy access
export const routeProvider = RouteProvider.getInstance(); 