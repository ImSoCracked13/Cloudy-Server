import * as safeBypasser from '../middlewares/safeBypasser';
import * as cookie from '../middlewares/infoReminder';

/**
 * Middleware Provider for Dependency Injection
 */
export class MiddlewareProvider {
  private static instance: MiddlewareProvider;

  private constructor() {}

  /**
   * Get the singleton instance of MiddlewareProvider
   */
  public static getInstance(): MiddlewareProvider {
    if (!MiddlewareProvider.instance) {
      MiddlewareProvider.instance = new MiddlewareProvider();
    }
    return MiddlewareProvider.instance;
  }

  /**
   * Get safe bypasser middleware (CORS, Helmet)
   */
  public getSafeBypasser(): typeof safeBypasser {
    return safeBypasser;
  }

  /**
   * Get cookie middleware
   */
  public getInfoReminder(): typeof cookie {
    return cookie;
  }

  /**
   * Reset middlewares (useful for testing)
   */
  public resetMiddlewares(): void {
    // Reset any stateful middlewares if needed
  }
}

// Export a singleton instance for easy access
export const middlewareProvider = MiddlewareProvider.getInstance(); 