import { UserController, userControllerInstance } from '../controllers/userController';
import { FileController, fileControllerInstance } from '../controllers/fileController';

/**
 * Controller Provider for Dependency Injection
 * This class manages controller instances
 */
export class ControllerProvider {
  private static instance: ControllerProvider;
  private userController: UserController;
  private fileController: FileController;

  private constructor() {
    // Initialize controllers
    this.userController = userControllerInstance;
    this.fileController = fileControllerInstance;
  }

  /**
   * Get the singleton instance of ControllerProvider
   */
  public static getInstance(): ControllerProvider {
    if (!ControllerProvider.instance) {
      ControllerProvider.instance = new ControllerProvider();
    }
    return ControllerProvider.instance;
  }

  /**
   * Get user controller instance
   */
  public getUserController(): UserController {
    return this.userController;
  }

  /**
   * Get file controller instance
   */
  public getFileController(): FileController {
    return this.fileController;
  }

  /**
   * Reset controllers (useful for testing)
   */
  public resetControllers(): void {
    // Reset any stateful controllers if needed
  }
}

// Export a singleton instance for easy access
export const controllerProvider = ControllerProvider.getInstance(); 