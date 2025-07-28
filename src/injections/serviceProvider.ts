import { FileService } from '../services/fileService';
import { UserService } from '../services/userService';

/**
 * Service Provider for Dependency Injection
 */
export class ServiceProvider {
  private static instance: ServiceProvider;
  
  private _fileService: FileService | null = null;
  private _userService: UserService | null = null;

  private constructor() {}

  /**
   * Get the singleton instance of ServiceProvider
   */
  public static getInstance(): ServiceProvider {
    if (!ServiceProvider.instance) {
      ServiceProvider.instance = new ServiceProvider();
    }
    return ServiceProvider.instance;
  }

  /**
   * Get FileService instance
   */
  public getFileService(): FileService {
    if (!this._fileService) {
      this._fileService = new FileService();
    }
    return this._fileService;
  }

  /**
   * Get UserService instance
   */
  public getUserService(): UserService {
    if (!this._userService) {
      this._userService = new UserService();
    }
    return this._userService;
  }
  
  /**
   * Handle Google authentication
   * This is a convenience method to access the UserService.googleAuth method
   */
  public googleAuth(googleToken: string): Promise<any> {
    return this.getUserService().googleAuth(googleToken);
  }

  /**
   * Reset all services (useful for testing)
   */
  public resetServices(): void {
    this._fileService = null;
    this._userService = null;
  }
}

// Export a singleton instance for easy access
export const serviceProvider = ServiceProvider.getInstance(); 