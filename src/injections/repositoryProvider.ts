import { FileRepository } from '../repositories/fileRepository';
import { UserRepository } from '../repositories/userRepository';

/**
 * Repository Provider for Dependency Injection
 */
export class RepositoryProvider {
  private static instance: RepositoryProvider;

  private constructor() {}

  /**
   * Get the singleton instance of RepositoryProvider
   */
  public static getInstance(): RepositoryProvider {
    if (!RepositoryProvider.instance) {
      RepositoryProvider.instance = new RepositoryProvider();
    }
    return RepositoryProvider.instance;
  }

  /**
   * Get FileRepository instance
   */
  public getFileRepository(): typeof FileRepository {
    return FileRepository;
  }

  /**
   * Get UserRepository instance
   */
  public getUserRepository(): typeof UserRepository {
    return UserRepository;
  }

  /**
   * Reset all repositories (useful for testing)
   */
  public resetRepositories(): void {
    // Reset repositories as needed
  }
}

// Export a singleton instance for easy access
export const repositoryProvider = RepositoryProvider.getInstance(); 