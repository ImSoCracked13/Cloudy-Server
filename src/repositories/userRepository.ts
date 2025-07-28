import { configProvider, eq, or, ilike } from '../injections/configProvider';
import { schemaProvider } from '../injections/schemaProvider';
import { User } from '../injections/typeProvider';

export class UserRepository {
  /**
   * Create a new user
   */
  static async createUser(userData: Partial<User>): Promise<User> {
    const db = configProvider.getDatabase();
    const { users } = schemaProvider.getUserSchema();
    const result = await db.insert(users).values(userData).returning();
    const user = Array.isArray(result) ? result[0] : result;
    return user as User;
  }

    /**
   * Update a user's properties
   */
    static async updateUser(id: string, userData: Partial<User>): Promise<User | null> {
      const db = configProvider.getDatabase();
      const { users } = schemaProvider.getUserSchema();
      const [updatedUser] = await db
        .update(users)
        .set({ ...userData, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return updatedUser ? (updatedUser as User) : null;
    }
  
    /**
     * Delete a user
     */
    static async deleteUser(id: string): Promise<void> {
      const db = configProvider.getDatabase();
      const { users } = schemaProvider.getUserSchema();
      
      // First verify the user exists
      const existingUser = await this.findById(id);
      if (!existingUser) {
        return;
      }
      
      // Delete the user
      await db.delete(users).where(eq(users.id, id));
    }

  /**
   * Find a user by ID
   */
  static async findById(id: string): Promise<User | null> {
    const db = configProvider.getDatabase();
    const { users } = schemaProvider.getUserSchema();
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user ? (user as User) : null;
  }

  /**
   * Find a user by email
   */
  static async findByEmail(email: string): Promise<User | null> {
    const db = configProvider.getDatabase();
    const { users } = schemaProvider.getUserSchema();
    
    // Normalize email to lowercase for consistent matching
    const normalizedEmail = email.toLowerCase().trim();
    
    // Try exact match first
    let [user] = await db.select().from(users).where(eq(users.email, normalizedEmail));
    
    // If not found, try case-insensitive match
    if (!user) {
      [user] = await db.select().from(users).where(ilike(users.email, normalizedEmail));
    }
    
    return user ? (user as User) : null;
  }

  /**
   * Find a user by username or email
   */
  static async findByUsernameOrEmail(usernameOrEmail: string): Promise<User | null> {
    const db = configProvider.getDatabase();
    const { users } = schemaProvider.getUserSchema();
    
    // Normalize input to lowercase for consistent matching
    const normalizedInput = usernameOrEmail.toLowerCase().trim();
    
    // First try to find by exact email match
    if (normalizedInput.includes('@')) {
      const [userByEmail] = await db.select().from(users).where(ilike(users.email, normalizedInput));
      
      if (userByEmail) {
        return userByEmail as User;
      }
    }
    
    // Then try to find by username
    const [userByUsername] = await db.select().from(users).where(ilike(users.username, normalizedInput));
    
    if (userByUsername) {
      return userByUsername as User;
    }
    
    // If still not found, try a broader search with OR condition
    const [user] = await db.select().from(users).where(
      or(
        ilike(users.email, normalizedInput),
        ilike(users.username, normalizedInput)
      )
    );
    
    return user ? (user as User) : null;
  }

  /**
   * Find a user by Google ID
   */
  static async findByGoogleId(googleId: string): Promise<User | null> {
    const db = configProvider.getDatabase();
    const { users } = schemaProvider.getUserSchema();
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user ? (user as User) : null;
  }

  /**
   * Update a user's storage usage
   */
  static async updateStorageUsed(id: string, storageUsed: number): Promise<void> {
    const db = configProvider.getDatabase();
    const { users } = schemaProvider.getUserSchema();
    await db
      .update(users)
      .set({ 
        storageUsed, 
        lastStorageUpdate: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(users.id, id));
  }

  /**
   * Find a user by verification token
   */
  static async findByVerificationToken(token: string): Promise<User | null> {
    const db = configProvider.getDatabase();
    const { users } = schemaProvider.getUserSchema();
    const now = new Date();
    
    // Find users with matching token and valid expiration
    const validUsers = await db
      .select()
      .from(users)
      .where(eq(users.verificationToken, token)) as User[];
    
    // Filter in JS to avoid SQL type issues
    if (validUsers.length === 0) return null;
    
    // Return the first user with a valid token (null expiry or future expiry)
    const user = validUsers.find(user => 
      user.verificationExpires === null || 
      user.verificationExpires > now
    );
    return user || null;
  }
} 