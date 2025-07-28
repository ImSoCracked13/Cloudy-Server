import { serviceProvider } from '../injections/serviceProvider';
import { dtoProvider } from '../injections/dtoProvider';

export class UserController {
  private userService;

  constructor() {
    // Get services from providers
    this.userService = serviceProvider.getUserService();

  }
  
  // Register a new user
  async register(userData: any): Promise<any> {
    try {
      
      try {
        const user = await this.userService.register(userData);
      
        // Convert to DTO
        const userDto = dtoProvider.getUserDto().toUserResponseDto(user);
        
        // For local users, set flag to tell client to show verification screen
        const needsVerification = userData.authProvider === 'local';
      
        // Email Token will be here
        const result = {
          success: true,
          message: needsVerification
            ? 'Registration successful. Please verify your email.'
            : 'Registration successful.',
          data: {
            user: userDto,
            token: user.verificationToken,
            verificationRequired: needsVerification,
            verificationToken: user.verificationToken
          }
        };
      
      return result;
      } catch (error) {
        // Check if this is a duplicate account error
        if (error instanceof Error && error.message.includes('already exists')) {
          throw new Error(`User with email ${userData.email} already exists. Please login instead.`);
        }
      }
    } catch (error) {
      throw error;
    }
  }
  
  // Login a user
  async login(usernameOrEmail: string, password: string): Promise<any> {
    try {
      const { user, token } = await this.userService.login(usernameOrEmail, password);
      
      // Convert to DTO
      const userDto = dtoProvider.getUserDto().toUserResponseDto(user);
      
      const result = {
        success: true,
        message: 'Login successful',
        data: {
          user: userDto,
          token: token
        }
      };
      
      return result;
    } catch (error) {
      throw error;
    }
  }

  async googleAuth(googleToken: string) {
    try {
      // Call the service to handle Google authentication
      const { user, token } = await serviceProvider.googleAuth(googleToken);
      
      if (!user || !token) {
        throw new Error('Google authentication failed');
      }
      // Convert to DTO 
      const userDto = dtoProvider.getUserDto().toUserResponseDto(user);
      
      return {
        success: true,
        message: 'Google login successful',
        data: {
          token,
          user: {
            userDto,
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role || 'user',
            authProvider: user.authProvider,
            isVerified: user.isVerified,
            storageUsed: user.storageUsed,
            storageLimit: user.storageLimit || 5 * 1024 * 1024 * 1024 // Default to 5GB
          }
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle user logout
   */
  async logout(token: string): Promise<void> {
    try {
      
      // Call the service to handle logout
      await this.userService.logout(token);
      
    } catch (error) {
      throw new Error('Failed to logout user');
    }
  }
  
  /**
   * Delete user account
   */
  async deleteAccount(token: string, password?: string): Promise<any> {
    try {
      
      // Call the service layer to handle token verification and deletion
      const deleteResult = await this.userService.deleteAccount(token, password);
      
      if (!deleteResult) {
        throw new Error('Failed to delete account');
      }
      
      return {
        success: true,
        message: 'Account deleted successfully'
      };
    } catch (error) {
      throw new Error('Failed to delete account');
    }
  }
  
  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<any> {
    try {
      
      // Attempt to verify email
      const user = await this.userService.verifyEmail(token);
      
      // Return success response with user object
      return {
        success: true,
        message: 'Email verified successfully',
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          isVerified: user.isVerified,
          authProvider: user.authProvider
        }
      };
    } catch (error) {
      
      // Handle different error cases
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify email';
      
      // Create detailed error response
      return {
        success: false,
        message: errorMessage,
        error: 'VERIFICATION_FAILED',
        details: error instanceof Error ? error.stack : undefined
      };
    }
  }

  /**
   * Resend verification email to user
   */
  async sendVerificationEmail(email: string): Promise<{ success: boolean; message: string; token?: string }> {
    try {
      // First check if the user exists and needs verification
      const user = await this.userService.findByEmail(email);
      
      // If the user doesn't exist or is already verified or is using social login
      if (!user) {
        throw new Error('Email not found');
      }
      
      if (user.isVerified) {
        throw new Error('Email is already verified');
      }
      
      if (user.authProvider !== 'local') {
        throw new Error('Social login accounts do not require email verification');
      }
      
      // Generate a new verification token
      const result = await this.userService.sendVerificationEmail(email);

      // Return success with token for client-side email sending
      return {
        success: true,
        message: 'Verification email has been sent. Please check your inbox.',
        token: result.token
      };
    } catch (error) {
      throw new Error('Failed to resend verification email');
    }
  }

  /**
   * Get current user profile from token
   */
  async getCurrentUser(token: string) {
    try {
      // Verify token and get user ID
      const decoded = await this.userService.verifyToken(token);
      
      if (!decoded || !decoded.id) {
        throw new Error('Invalid token');
      }
      
      // Get user profile
      const user = await this.userService.findById(decoded.id);
      
      if (!user) {
        throw new Error('User not found');
      }

      // Auto delete unverified accounts
      if (!user.isVerified && user.createdAt && Date.now() - new Date(user.createdAt).getTime() > 10 * 1000) {
        await this.userService.deleteAccount(user.id);
        throw new Error('Unverified account deleted after 10s');
      }

      return user;
    } catch (error) {
      throw error;
    }
  }
}

// Create an instance to use in routes
export const userControllerInstance = new UserController(); 