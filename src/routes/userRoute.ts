import { controllerProvider } from '../injections/controllerProvider';
import { middlewareProvider } from '../injections/middlewareProvider';

/**
 * Setup user routes
 */
export const userRoute = (app: any) => {
  // Get middleware from provider
  const safeBypasser = middlewareProvider.getSafeBypasser();
  const infoReminder = middlewareProvider.getInfoReminder();
  
  // Get controller
  const userController = controllerProvider.getUserController();
  
  // Apply security and cookie middleware
  app = safeBypasser.applySecurityMiddleware(app);
  app = infoReminder.applyCookie(app);

  /**
   * Helper function to verify JWT authentication for user operations
   */
  const verifyAuth = async (context: any) => {
    let token = context.cookies?.jwt;

    if (!token) {
      const headerValue = 
        // Request headers map
        context.request?.headers?.get('Authorization') ||
        // Elysia native headers
        context.header?.Authorization;
      
      if (headerValue) {
        const [type, value] = headerValue.split(' ');
        if (type === 'Bearer' && value) {
          token = value;
          // Currently cookie is not available
          context.set.cookie = {
            jwt: value,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 60 * 60,
            path: '/'
          };
        }
      }
    }
    
    try {
      // Verify the token using Elysia's JWT
      const payload = await context.jwt.verify(token);
      if (!payload || !payload.id) {
        console.warn('Invalid token payload');
        context.set.status = 401;
        return {
          success: false,
          message: 'Invalid authentication token',
          error: 'Unauthorized'
        };
      }

      // Log successful authentication
      console.log('Auth successful for user:', payload.id);
      
      // Add user data to context
      context.id = payload.id;
      context.email = payload.email;
      
      return null; // Auth passed
    } catch (error) {
      console.warn('Token verification failed:', error);
      context.set.status = 401;
      return {
        success: false,
        message: 'Invalid authentication token',
        error: 'Unauthorized'
      };
    }
  };

  return app
    // Register
    .post('/register', async ({ body }: { body: any, set: any }) => {
      try {
        const result = await userController.register(body);
        console.log('Register successful for:', result);

        return result;

      } catch (error) {
        console.error('Registration error:', error);
      }
    })

    // Login
    .post('/login', async ({ body }: { body: any, set: any }) => {
      try {
        // Extract and validate login credentials
        if (!body || typeof body !== 'object') {
          throw new Error('Invalid request body');
        }

        const { loginIdentifier, password } = body;
        
        if (!loginIdentifier || !password) {
          throw new Error('Login identifier and password are required');
        }

        // Clean and validate the input
        const cleanIdentifier = String(loginIdentifier).trim();
        const cleanPassword = String(password).trim();

        if (!cleanIdentifier || !cleanPassword) {
          throw new Error('Login identifier and password cannot be empty');
        }
        
        // Call the controller with the appropriate identifier
        const result = await userController.login(cleanIdentifier, cleanPassword);
        
        // Double-check we have a valid result object
        if (!result) {
          throw new Error('Login controller returned null/undefined result');
        }
        
        // Ensure the result object has required properties
        if (typeof result !== 'object') {
          throw new Error('Login controller returned non-object result');
        }
        
        // Log the response
        console.log('Login successful for:', cleanIdentifier);
        
        return result;
      } catch (error) {
        console.error('Login route error:', error);
      }
    })
    
    // Google OAuth
    .post('/google', async ({ body }: { body: any, set: any }) => {
      try {
        // Extract and validate login credentials
        if (!body || typeof body !== 'object') {
            throw new Error('Invalid request body');
        }

        const { token, credential } = body;
        
        if (!token && !credential) {
          throw new Error('No Google token provided');
        }

        // Call the controller to handle Google authentication
        const result = await userController.googleAuth(token || credential);
        console.log('Google Authentication successful', result);
        
        return result;
      } catch (error) {
        console.error('Google Auth route error:', error);
      }
    })

    // Logout
    .post('/logout', async (context: any) => {
      try {
        // Verify authentication
        const authError = await verifyAuth(context);
        if (authError) return authError;
        
        // Get the token that was just verified
        let token = context.cookies?.jwt;
        if (!token) {
          const headerValue = context.request?.headers?.get('Authorization') || context.header?.Authorization;
          if (headerValue) {
            const [type, value] = headerValue.split(' ');
            if (type === 'Bearer' && value) {
              token = value;
            }
          }
        }
        
        await userController.logout(token);
        
        return {
          success: true,
          message: 'Logged out successfully'
        };
      } catch (error) {
        console.error('Logout route error:', error);
      }
    })
    
    // Verify Email 
    .get('/verify/:token', async ({ params }: { params: any }) => {
      try {
        const result = await userController.verifyEmail(params.token);
        console.log('Verify email successful for: ', result);
        
        if (!result.success) {
          throw new Error('Failed to verify email');
        }
        
        return result;
      } catch (error) {
        console.error('Verify Email Route error:', error);
      }
    })
    
    // Send verification email
    .post('/send-verification', async ({ body }: { body: any }) => {
      return await userController.sendVerificationEmail((body as any).email);
    })
    
    // Delete account
    .delete('/account', async (context: any) => {
      try {
        // Verify authentication
        const authError = await verifyAuth(context);
        if (authError) return authError;
        
        // Get the token that was just verified
        let token = context.cookies?.jwt;
        if (!token) {
          const headerValue = context.request?.headers?.get('Authorization') || context.header?.Authorization;
          if (headerValue) {
            const [type, value] = headerValue.split(' ');
            if (type === 'Bearer' && value) {
              token = value;
            }
          }
        }
        
        // Extract password from request body
        const { password } = context.body || {};
        
        // Call controller to delete account with token
        const result = await userController.deleteAccount(token, password);
        
        if (!result.success) {
          context.set.status = result.error === 'UNAUTHORIZED' ? 401 : 400;
        }
        
        return result;
      } catch (error: any) {
        console.error('Delete account route error:', error);
      }
    })

    // Get current user
    .get('/profile', async (context: any) => {
      try {
        // Verify authentication
        const authError = await verifyAuth(context);
        if (authError) return authError;
        
        // After verifyAuth, we know we have a valid token
        let token = context.cookies?.jwt;
        if (!token) {
          const headerValue = context.request?.headers?.get('Authorization') || context.header?.Authorization;
          if (headerValue) {
            const [type, value] = headerValue.split(' ');
            if (type === 'Bearer' && value) {
              token = value;
            }
          }
        }
        
        const user = await userController.getCurrentUser(token);
        console.log('Current user is:', user);
        
        return {
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              username: user.username,
              role: user.role,
              authProvider: user.authProvider,
              isVerified: user.isVerified,
              storageUsed: user.storageUsed,
              storageLimit: user.storageLimit
            }
          }
        };
      } catch (error) {
        console.error('Getting current user route error:', error);
      }
    })
};