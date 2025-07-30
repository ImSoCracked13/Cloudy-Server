import * as cors from '../middlewares/safeBypasser';
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
   * Get CORS middleware
   */
  public getSafeBypasser(): typeof cors {
    return cors;
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