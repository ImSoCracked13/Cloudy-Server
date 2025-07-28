import { configProvider } from '../injections/configProvider';

/**
 * Apply CORS middleware to an Elysia app
 */
export const applyCors = (app: any, corsConfig: any = {}): any => {
  return configProvider.applyCors(app, corsConfig);
};

/**
 * Apply security middleware to an Elysia app
 */
export const applySecurityMiddleware = (app: any, options: {
  corsConfig?: any
} = {}): any => {
  // Apply CORS using the centralized configuration
  return applyCors(app, options.corsConfig);
}; 