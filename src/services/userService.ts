import { repositoryProvider } from '../injections/repositoryProvider';
import { serviceProvider } from '../injections/serviceProvider';
import { utilityProvider } from '../injections/utilityProvider';

// Default storage limit (5GB)
const DEFAULT_STORAGE_LIMIT = 5368709120;

export class UserService {
  private readonly VERIFICATION_TOKEN_EXPIRY = parseInt(process.env.VERIFICATION_TOKEN_EXPIRY || '86400000'); // 24 hours in ms
  private userRepository;
  private logger;
  private passwordHasher;
  private storageHelper;
  private cacheHandler;
  private validator;
  private encoder;
  private emailHandler;

  constructor() {
    this.userRepository = repositoryProvider.getUserRepository();
    this.logger = utilityProvider.getLogger();
    this.passwordHasher = utilityProvider.getPasswordHasher();
    this.storageHelper = utilityProvider.getStorageHelper();
    this.cacheHandler = utilityProvider.getCacheHandler();
    this.validator = utilityProvider.getValidator();
    this.encoder = utilityProvider.getEncoder();
    this.emailHandler = utilityProvider.getEmailHandler();
  }

  /**
   * Register a new user
   */
  async register(userData: any): Promise<any> {
    this.logger.info(`Registering new user with email ${userData.email}`, { authProvider: userData.authProvider });
    
    // Validate email
    if (!this.validator.isValidEmail(userData.email)) {
      throw new Error('Invalid email format');
    }
    
    // Validate password for local auth
    if (userData.authProvider === 'local' && !this.validator.isValidPassword(userData.password)) {
      throw new Error('Password must be at least 8 characters with at least one letter and one number');
    }
    
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(userData.email);
    
    if (existingUser) {
      throw new Error(`User with email ${userData.email} already exists. Please login instead.`);
    }

    // Check if user already exists with Google ID
    const existingGoogleUser = await this.userRepository.findByGoogleId(userData.googleId);
    if (existingGoogleUser) {
      throw new Error(`User with Google ID ${userData.googleId} already exists. Please login instead.`);
    }

    // Hash password for local users
    let hashedPassword = null;
    if (userData.authProvider === 'local' && userData.password) {
      hashedPassword = this.passwordHasher.hashPassword(userData.password);
    }

    // Generate verification token using secure crypto
    const verificationToken = userData.authProvider === 'local' ? await this.emailHandler.generateVerificationToken() : null;

    // Create user with proper typing
    let user;
    try {
      const userRecord = {
        email: userData.email,
        username: userData.username || userData.email.split('@')[0],
        password: hashedPassword,
        googleId: userData.googleId || null,
        authProvider: userData.authProvider,
        role: 'user',
        isVerified: userData.authProvider === 'google', // Google users are pre-verified
        verificationToken: verificationToken,
        verificationExpires: userData.authProvider === 'local' ? new Date(Date.now() + this.VERIFICATION_TOKEN_EXPIRY) : null,
        storageUsed: 0,
        storageLimit: DEFAULT_STORAGE_LIMIT,
        lastStorageUpdate: new Date()
      };
      
      this.logger.info(`Creating user record: ${JSON.stringify({
        email: userRecord.email,
        username: userRecord.username,
        authProvider: userRecord.authProvider,
        isVerified: userRecord.isVerified
      })}`);
      
      user = await this.userRepository.createUser(userRecord);
      this.logger.info(`User created successfully: ${user.id}`);
    } catch (userCreateError) {
      throw new Error(`User creation failed: ${userCreateError instanceof Error ? userCreateError.message : 'Unknown error'}`);
    }
    
    // Create database records for folders and initial folder structure in storage
    try {
      const fileService = serviceProvider.getFileService();
      
      this.logger.info(`Creating folder database records for user ${user.id}`);
      
      // Force isGoogleUser to be a boolean to avoid any type issues
      const isGoogleUserBool = userData.authProvider === 'google';
      
      await fileService.createInitialFolderStructure(user.id, isGoogleUserBool);
      
    } catch (dbError) {
      this.logger.error(`Error creating folder database records for user ${user.id}`, dbError);
    }

    // For local users, set the verification token via email, which will be sent by the frontend using EmailJS
    if (userData.authProvider === 'local' && verificationToken) {
      this.logger.info(`Verification token created for ${user.email}, email will be sent by frontend`);
      
      // Store in cache that we've prepared a token for this user
      try {
        const cacheKey = `verification_token_created:${user.email}`;
        await this.cacheHandler.setInCache(cacheKey, 'true', 60 * 60); // Cache for 1 hour
      } catch (cacheError) {
        this.logger.warn(`Failed to store verification token in cache: ${cacheError instanceof Error ? cacheError.message : 'Unknown error'}`);
      }
    }

    // Auto account deletion for local users if not verified
    if (userData.authProvider === 'local' && !user.isVerified) {
      this.logger.info(`User ${user.email} is not verified, scheduling auto account deletion`);
      
      // Schedule deletion after 1 hour
      setTimeout(async () => {
        try {
          // Check if user still exists and is still unverified
          const currentUser = await this.userRepository.findById(user.id);
          if (currentUser && !currentUser.isVerified && currentUser.authProvider === 'local') {
            // Clean up user's storage folders
            try {
              const baseFolder = 'Local Users';
              const userBasePath = `${baseFolder}/${user.id}/`;
              await this.storageHelper.deleteFolder(userBasePath);
              this.logger.info(`Storage folders deleted for user ${user.id}`);
            } catch (storageError) {
              this.logger.warn(`Failed to delete storage for user ${user.id}:`, storageError);
            }
            
            // Clean up user's files from database
            try {
              const fileRepository = repositoryProvider.getFileRepository();
              await fileRepository.deleteAllFilesByUserId(user.id);
              this.logger.info(`Database file records deleted for user ${user.id}`);
            } catch (dbError) {
              this.logger.warn(`Failed to delete file records for user ${user.id}:`, dbError);
            }
            
            // Delete user from database
            await this.userRepository.deleteUser(user.id);
            
            // Clear user's cache entries
            try {
              await this.cacheHandler.deleteFromCache(`user:${user.id}:*`);
              await this.cacheHandler.deleteFromCache('users:active');
              this.logger.info(`Cache entries cleared for user ${user.id}`);
            } catch (cacheError) {
              this.logger.warn(`Failed to clear cache for user ${user.id}:`, cacheError);
            }
            
            this.logger.info(`Auto-deleted unverified user ${user.email}`);
          } else if (!currentUser) {
            this.logger.info(`User ${user.email} no longer exists, skipping auto-deletion`);
          } else if (currentUser.isVerified) {
            this.logger.info(`User ${user.email} is now verified, skipping auto-deletion`);
          }
        } catch (deleteError) {
          this.logger.error(`Failed to auto-delete unverified user ${user.email}:`, deleteError);
        }
      }, 1000 * 60 * 60); // 1 hour
    }

    this.logger.info(`User registration completed: ${user.id}`);
    
    return user;
  }

  /**
   * Login a user
   */
  async login(usernameOrEmail: string, password: string): Promise<any> {
    this.logger.info(`Login attempt for ${usernameOrEmail}`);
    
    // Normalize the input
    const normalizedInput = usernameOrEmail.trim();
    let user = null;
    
    // Find user by username or email
    const userRepository = repositoryProvider.getUserRepository();
    
    // First try direct lookup
    user = await userRepository.findByUsernameOrEmail(normalizedInput);
    
    // If not found and it looks like an email, try explicit email lookup
    if (!user && normalizedInput.includes('@')) {
      this.logger.info(`No user found with initial search, trying explicit email lookup for: ${normalizedInput}`);
      user = await userRepository.findByEmail(normalizedInput);
    }
    
    // If no user found, return null
    if (!user) {
      this.logger.warn(`Login failed: No user found with username/email ${normalizedInput}`);
      return null;
    }
    
    // If there is Google account with the same email, throw an error
    if (user.authProvider === 'google' && user.email === normalizedInput) {
      this.logger.warn(`Login failed: Google account ${normalizedInput} attempted password login`);
      return null;
    }
    
    // Verify password
    if (!user.password || !this.passwordHasher.verifyPassword(password, user.password)) {
      this.logger.warn(`Login failed: Invalid password for ${normalizedInput}`);
      return null;
    }
    
    // Check if email is verified
    if (!user.isVerified) {
      this.logger.warn(`Login failed: Unverified email for ${normalizedInput}`);
      return null;
    }
    
    this.logger.info(`User ${normalizedInput} logged in successfully`);
    
    // Store last login time in cache
    await this.cacheHandler.setHashField(`user:${user.id}:stats`, 'lastLogin', Date.now().toString());
    await this.cacheHandler.incrementHashField(`user:${user.id}:stats`, 'loginCount');
    
    // Track active user in cache
    await this.cacheHandler.addToSortedSet('users:active', Date.now(), user.id);
    
    // Generate a token for the user with authProvider explicitly included
    const token = await this.generateToken({ id: user.id, email: user.email, role: user.role, authProvider: user.authProvider });
    
    return { user, token };
  }

  /**
   * Handle Google authentication
   */
  async googleAuth(googleToken: string): Promise<any> {
    this.logger.info(`Processing Google authentication`);
    
    // Import Google config
    const { verifyGoogleToken } = require('../configs/feature/google.config');
    
    // Verify the Google token
    const googleUser = await verifyGoogleToken(googleToken);
    if (!googleUser) {
      throw new Error('Invalid Google token');
    }
    
    this.logger.info(`Google token verified for email ${googleUser.email}`);
    
    // Validate email format
    if (!this.validator.isValidEmail(googleUser.email)) {
      throw new Error('Invalid email format from Google account');
    }
    
    // Check if user exists
    let user = await this.userRepository.findByGoogleId(googleUser.id);
    
    // If user not found by Google ID, try finding by email
    if (!user) {
      user = await this.userRepository.findByEmail(googleUser.email);
      
      // If a user with this email exists but has local auth provider, reject
      if (user && user.authProvider === 'local') {
        throw new Error('A user with this email already exists with password authentication');
      }
      
      // If user exists but doesn't have googleId, update their profile
      if (user) {
        this.logger.info(`Updating existing user ${user.id} with Google information`);
        
        // Update Google ID and potentially username
        const updates: any = { googleId: googleUser.id };
        
        // Update username with name from Google if not already set
        if ((!user.username || user.username === user.email.split('@')[0]) && 
            googleUser.firstName && googleUser.lastName) {
          const generatedUsername = `${googleUser.firstName}${googleUser.lastName}`.toLowerCase();
          updates.username = generatedUsername;
        }
        
        // Update the user record
        await this.userRepository.updateUser(user.id, updates);
        
        // Reload user to get updated data
        user = await this.userRepository.findById(user.id);
      }
    }
    
    // If user still not found, register a new one
    if (!user) {
      this.logger.info(`Creating new user for Google account ${googleUser.email}`);
      
      const userData = {
        email: googleUser.email,
        username: `${googleUser.firstName}${googleUser.lastName}`.toLowerCase(),
        authProvider: 'google',
        isVerified: true, // Google users are pre-verified
        googleId: googleUser.id,
        role: 'user'
      };
      
      // Register the new user
      user = await this.register(userData);
    }
    
    // At this point, user must exist
    if (!user) {
      throw new Error('Failed to authenticate with Google');
    }
    
    // Generate JWT token for the user
    const token = await this.generateToken({
      id: user.id,
      email: user.email,
      role: user.role || 'user',
      authProvider: 'google'
    });
    
    this.logger.info(`Google authentication successful for user ${user.id}`);
    
    // Store last login time in cache
    await this.cacheHandler.setHashField(`user:${user.id}:stats`, 'lastLogin', Date.now().toString());
    await this.cacheHandler.incrementHashField(`user:${user.id}:stats`, 'loginCount');
    
    // Track active user in cache
    await this.cacheHandler.addToSortedSet('users:active', Date.now(), user.id);
    
    return {user, token};
  }

  /**
   * Handle user logout
   */
  async logout(token: string): Promise<void> {
    if (!token) {
      throw new Error('No token provided');
    }
    await this.encoder.invalidateToken(token);
    this.logger.info(`User logged out successfully`);
  }

  /**
   * Verify a user's email using the verification token
   */
  async verifyEmail(token: string): Promise<any> {
    
    try {
      //  Try to find a user with the exact token
      let user = await this.userRepository.findByVerificationToken(token);
      
      // If no user found with exact token, try to extract email from token
      if (!user) {
        this.logger.info('No user found with exact token, trying to get email from Redis');
        
        try {
          // Extract email from base64-encoded token (from EmailJS)
          this.logger.info(`Verifying email with token ${token.substring(0, 8)}...`);
          
          // Attempt to decode if it's a base64 token
          let email = null;
          try {
            this.logger.info(`Attempting to decode base64 token: ${token.substring(0, 8)}...`);
            // Add padding if needed to make it valid base64
            let paddedToken = token;
            while (paddedToken.length % 4 !== 0) {
              paddedToken += '=';
            }
            
            const decodedToken = Buffer.from(paddedToken, 'base64').toString('utf-8');
            
            // If the decoded token is an email (contains @ symbol)
            if (decodedToken.includes('@')) {
              email = decodedToken;
              this.logger.info(`Extracted email from base64 token: ${email}`);
            } else {
              this.logger.warn(`Decoded token doesn't appear to be an email: ${decodedToken.substring(0, 10)}...`);
            }
          } catch (decodeError) {
            this.logger.warn(`Failed to decode token as base64: ${decodeError instanceof Error ? decodeError.message : 'Unknown error'}`);
          }
          
          // If we extracted an email, find the user
          if (email) {
            user = await this.userRepository.findByEmail(email);
            
            if (!user) {
              this.logger.error(`No user found with email ${email}`);
              return null;
            }
            
            this.logger.info(`Found user with email from token: ${user.email}`);
            
            // This is needed for EmailJS verification flow where token is generated client-side
            if (!user.isVerified) {
              this.logger.info(`User ${user.email} found by email token, marking as verified`);

            } else {
              this.logger.info(`User ${user.email} is already verified`);
              return user;
            }
          }
          
          // Try to get from Redis if we have a user
          if (user) {
            // Check if user has a Redis verification token
            const cacheKey = `verification_token:${user.email}`;
            const redisToken = await this.cacheHandler.getFromCache(cacheKey);
            
            if (redisToken) {
              this.logger.info(`Found Redis token for user ${user.email}`);
              
              // Check verification expiry
              if (user.verificationExpires && new Date() > user.verificationExpires) {
                this.logger.warn(`Verification token expired for user ${user.email}`);
              }
            } else {
              this.logger.warn(`No Redis token found for user ${user.email}`);
            }
          } else {
            this.logger.error(`Could not find user with token ${token.substring(0, 8)}...`);
          }
        } catch (redisError) {
          this.logger.error(`Error verifying token with Redis: ${redisError instanceof Error ? redisError.message : 'Unknown error'}`);
        }
      }
      
      //  User should be found at this point
      if (!user) {
        this.logger.error(`No user found after all verification attempts`);
        return null;
      }
      
      // Update user verification status
      user.isVerified = true;
      user.verificationToken = null;
      user.verificationExpires = null;
      
      // Save the updated user
      await this.userRepository.updateUser(user.id, user);
      this.logger.info(`User ${user.email} email verified successfully`);
      
      // Clear any verification cache entries
      try {
        const cacheKey = `verification_token:${user.email}`;
        await this.cacheHandler.deleteFromCache(cacheKey);
      } catch (cacheError) {
        this.logger.warn(`Failed to clear verification cache: ${cacheError instanceof Error ? cacheError.message : 'Unknown error'}`);
      }
      
      return user;
    } catch (error) {
      this.logger.error(`Error verifying email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendVerificationEmail(email: string): Promise<any> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }
    const emailHandler = utilityProvider.getEmailHandler();
    const userRepository = repositoryProvider.getUserRepository();
    const newToken = await emailHandler.generateVerificationToken();
    const newExpiry = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours
    await userRepository.updateUser(user.id, {
      verificationToken: newToken,
      verificationExpires: newExpiry
    });
    await emailHandler.sendVerificationEmail(email, newToken);
    // Return the token for client-side email sending
    return {token: newToken };
  }

  /**
   * Delete user account
   */
  async deleteAccount(token: string, password?: string): Promise<boolean> {
    try {
      // Verify token and get user ID
      const decodedToken = await this.verifyToken(token);
      if (!decodedToken || !decodedToken.id) {
        this.logger.error('Invalid token payload for account deletion');
        throw new Error('Invalid token');
      }
      
      const userId = decodedToken.id;
      this.logger.info(`Processing account deletion for user ${userId}`);
      
      // Get user details
      const user = await this.findById(userId);
      if (!user) {
        this.logger.error(`Cannot delete account: User ${userId} not found`);
        throw new Error('User not found');
      }
      
      this.logger.info(`Found user to delete: ${userId} (Auth provider: ${user.authProvider})`);
      
      // For local users, verify password if provided
      if (user.authProvider === 'local' && password) {
        if (!this.passwordHasher.verifyPassword(password, user.password)) {
          this.logger.warn(`Account deletion failed: Invalid password for user ${userId}`);
          throw new Error('Invalid password');
        }
      }
      
      // Delete user's storage folders
      try {
        const baseFolder = user.authProvider === 'google' ? 'Google Users' : 'Local Users';
        const userBasePath = `${baseFolder}/${userId}/`;
        
        this.logger.info(`Deleting storage folders for user ${userId} at path ${userBasePath}`);
        await this.storageHelper.deleteFolder(userBasePath);
        this.logger.info(`Storage folders deleted for user ${userId}`);
      } catch (storageError) {
        this.logger.error(`Error deleting storage for user ${userId}:`, storageError);
        // Continue with account deletion even if storage deletion fails
      }
      
      // Delete user's files from database
      try {
        const fileRepository = repositoryProvider.getFileRepository();
        await fileRepository.deleteAllFilesByUserId(userId);
        this.logger.info(`Database file records deleted for user ${userId}`);
      } catch (dbError) {
        this.logger.error(`Error deleting file records for user ${userId}:`, dbError);
        // Continue with account deletion even if file deletion fails
      }
      
      // Delete user from database
      await this.userRepository.deleteUser(userId);
      this.logger.info(`User record deleted for ${userId}`);
      
      // Clear user's cache entries
      try {
        await this.cacheHandler.deleteFromCache(`user:${userId}:*`);
        await this.cacheHandler.deleteFromCache('users:active');
        this.logger.info(`Cache entries cleared for user ${userId}`);
      } catch (cacheError) {
        this.logger.warn(`Error clearing cache for user ${userId}:`, cacheError);
        // Continue since cache clearing is not critical
      }
      this.logger.info(`Account deletion successful for user ${userId}`);
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<any> {
    const userRepository = repositoryProvider.getUserRepository();
    const user = await userRepository.findById(id);
    this.logger.info(`Found user:`, user ? { id: user.id, email: user.email, authProvider: user.authProvider } : 'null');
    return user;
  }

  /**
   * Find a user by email address
   */
  async findByEmail(email: string): Promise<any> {
    try {
      this.logger.info(`Finding user by email: ${email}`);
      return await this.userRepository.findByEmail(email);
    } catch (error) {
      this.logger.error(`Error finding user by email ${email}:`, error);
    }
  }

  /**
   * Generate JWT token for user
   */
  async generateToken(user: any): Promise<string> {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role || 'user',
      authProvider: user.authProvider || 'local',
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour expiry
    };

    return await this.encoder.generateToken(payload);
  }

  /**
   * Verify a JWT token
   */
  async verifyToken(token: string): Promise<any> {
    return await this.encoder.verifyToken(token);
  }
}