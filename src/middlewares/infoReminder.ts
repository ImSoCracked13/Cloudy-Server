import { configProvider } from '../injections/configProvider';

/**
 * Apply cookie middleware to an Elysia app with secure defaults
 */
export const applyCookie = (app: any, cookieConfig: any = {}): any => {
  return configProvider.applyCookie(app, cookieConfig);
};