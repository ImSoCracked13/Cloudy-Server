import { Readable } from 'stream';
import { configProvider } from '../injections/configProvider';

/**
 * MinIO Helper for direct storage operations
 */
export class StorageHelper {
  private static instance: StorageHelper;
  private bucketName: string;
  private minioClient;
  
  // Use console as default logger and basic error handling
  private logger: any = console;
  private errorHandler: any = {
    StorageError: class StorageError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'StorageError';
      }
    }
  };

  private constructor() {
    this.bucketName = process.env.MINIO_BUCKET_NAME || 'cloudy';
    this.minioClient = configProvider.getMinioClient();
  }

  /**
   * Get the singleton instance of StorageHelper
   */
  public static getInstance(): StorageHelper {
    if (!StorageHelper.instance) {
      StorageHelper.instance = new StorageHelper();
    }
    return StorageHelper.instance;
  }

  /**
   * Upload a file to MinIO storage
   */
  async uploadFile(
    objectPath: string,
    fileBuffer: Buffer,
    size: number,
    metadata: Record<string, string>
  ): Promise<void> {
    try {
      this.logger.debug(`Uploading file to ${objectPath}, size: ${size} bytes`);
      
      // Check if the file buffer is valid
      if (!fileBuffer || !(fileBuffer instanceof Buffer)) {
        throw new Error('Invalid file buffer provided');
      }
      
      // Check if the parent directory exists and create it if needed
      const pathParts = objectPath.split('/');
      // Pop the filename but don't need to use it
      pathParts.pop();
      const parentPath = pathParts.join('/') + '/';
      
      if (parentPath !== '/') {
        try {
          await this.minioClient.statObject(this.bucketName, parentPath);
          this.logger.debug(`Parent folder exists at ${parentPath}`);
        } catch (error) {
          this.logger.debug(`Parent folder doesn't exist at ${parentPath}, creating it`);
          await this.createFolder(parentPath);
        }
      }
      
      // Upload the file
      await this.minioClient.putObject(
        this.bucketName,
        objectPath,
        fileBuffer,
        size,
        metadata
      );
      
      // Verify the file was uploaded successfully
      try {
        await this.minioClient.statObject(this.bucketName, objectPath);
        this.logger.debug(`File upload verified at ${objectPath}`);
      } catch (verifyError) {
        throw new Error(`Failed to verify file upload: ${
          verifyError instanceof Error ? verifyError.message : 'Unknown error'
        }`);
      }
      
      this.logger.debug(`File uploaded successfully to ${objectPath}`);
    } catch (error) {
      throw new this.errorHandler.StorageError('Failed to upload file to storage: ' + 
        (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Download a file from MinIO storage
   */
  async downloadFile(objectPath: string): Promise<{ stream: Readable; metadata: Record<string, string> }> {
    try {
      // Get file stats to get metadata
      const stat = await this.minioClient.statObject(this.bucketName, objectPath);
      
      // Get file stream
      const stream = await this.minioClient.getObject(this.bucketName, objectPath);
      
      return {
        stream,
        metadata: stat.metaData || {}
      };
    } catch (error) {
      throw new this.errorHandler.StorageError('Failed to download file from storage');
    }
  }

  /**
   * Rename a file in MinIO storage (implemented as copy + delete)
   */
  async renameFile(sourceObjectPath: string, destObjectPath: string): Promise<void> {
    try {
      // Normalize paths
      const normalizedSourcePath = this.normalizePath(sourceObjectPath);
      const normalizedDestPath = this.normalizePath(destObjectPath);
      
      this.logger.debug(`Renaming file from ${normalizedSourcePath} to ${normalizedDestPath}`);
      
      // Ensure source file exists
      try {
        await this.minioClient.statObject(this.bucketName, normalizedSourcePath);
      } catch (error) {
        this.logger.warn(`Source file does not exist: ${normalizedSourcePath}`, error);
      }
      
      // Ensure parent directory of destination exists
      const destPathParts = normalizedDestPath.split('/');
      destPathParts.pop(); // Remove the filename
      const destParentPath = destPathParts.join('/') + '/';
      
      if (destParentPath !== '/') {
        try {
          await this.minioClient.statObject(this.bucketName, destParentPath);
          this.logger.debug(`Destination parent folder exists at ${destParentPath}`);
        } catch (error) {
          this.logger.debug(`Destination parent folder doesn't exist at ${destParentPath}, creating it`);
          await this.createFolder(destParentPath);
        }
      }
      
      // Copy the file to the new location
      const copySource = `/${this.bucketName}/${normalizedSourcePath}`;
      await this.minioClient.copyObject(
        this.bucketName,
        normalizedDestPath,
        copySource
      );
      
      // Verify the file was copied successfully
      try {
        await this.minioClient.statObject(this.bucketName, normalizedDestPath);
        this.logger.debug(`File copy verified at ${normalizedDestPath}`);
      } catch (verifyError) {
        this.logger.error(`Failed to verify file copy at ${normalizedDestPath}:`, verifyError);
      }
      
      // Delete the source file
      await this.minioClient.removeObject(this.bucketName, normalizedSourcePath);
      this.logger.debug(`File renamed successfully from ${normalizedSourcePath} to ${normalizedDestPath}`);
    } catch (error) {
      this.logger.error(`Error renaming file from ${sourceObjectPath} to ${destObjectPath}:`, error);
    }
  }

  /**
   * Copy a file within MinIO storage
   */
  async duplicateFile(sourceObjectPath: string, destObjectPath: string): Promise<void> {
    try {
      // Normalize paths to remove any leading slashes for MinIO
      const normalizedSourcePath = sourceObjectPath.startsWith('/') ? sourceObjectPath.substring(1) : sourceObjectPath;
      const normalizedDestPath = destObjectPath.startsWith('/') ? destObjectPath.substring(1) : destObjectPath;
      
      this.logger.debug(`Copying file from ${normalizedSourcePath} to ${normalizedDestPath}`);
      
      // Ensure the source file exists
      try {
        await this.minioClient.statObject(this.bucketName, normalizedSourcePath);
      } catch (error) {
        this.logger.warn(`Source file does not exist: ${normalizedSourcePath}`, error);
      }
      
      // Ensure parent directory of destination exists
      const destPathParts = normalizedDestPath.split('/');
      destPathParts.pop(); // Remove the filename
      const destParentPath = destPathParts.join('/') + '/';
      
      if (destParentPath !== '/') {
        try {
          await this.minioClient.statObject(this.bucketName, destParentPath);
          this.logger.debug(`Destination parent folder exists at ${destParentPath}`);
        } catch (error) {
          this.logger.debug(`Destination parent folder doesn't exist at ${destParentPath}, creating it`);
          await this.createFolder(destParentPath);
        }
      }
      
      // Use copyObject with the correct format for the source path
      const copySource = `/${this.bucketName}/${normalizedSourcePath}`;
      
      await this.minioClient.copyObject(
        this.bucketName,
        normalizedDestPath,
        copySource
      );
      
      // Verify the file was copied successfully
      try {
        await this.minioClient.statObject(this.bucketName, normalizedDestPath);
        this.logger.debug(`File copy verified at ${normalizedDestPath}`);
      } catch (verifyError) {
        throw new Error(`Failed to verify file copy: ${
          verifyError instanceof Error ? verifyError.message : 'Unknown error'
        }`);
      }
      
      this.logger.debug(`File copied successfully from ${normalizedSourcePath} to ${normalizedDestPath}`);
    } catch (error) {
      throw new this.errorHandler.StorageError('Failed to copy file in storage: ' + 
        (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Move a file from one location to another
   */
  async moveFile(sourcePath: string, destinationPath: string): Promise<boolean> {
    try {
      // Normalize paths
      const normalizedSourcePath = this.normalizePath(sourcePath);
      const normalizedDestPath = this.normalizePath(destinationPath);
      
      this.logger.debug(`Moving file from ${normalizedSourcePath} to ${normalizedDestPath}`);
      
      // Check if source exists
      try {
        await this.minioClient.statObject(this.bucketName, normalizedSourcePath);
      } catch (error) {
        this.logger.warn(`Source file does not exist: ${normalizedSourcePath}`);
        return false;
      }
      
      // Copy file to destination
      await this.minioClient.copyObject(
        this.bucketName, 
        normalizedDestPath,
        `${this.bucketName}/${normalizedSourcePath}`
      );
      
      // Delete source file
      await this.minioClient.removeObject(this.bucketName, normalizedSourcePath);
      
      this.logger.debug(`Successfully moved file from ${normalizedSourcePath} to ${normalizedDestPath}`);
      return true;
    } catch (error) {
      this.logger.error(`Error moving file from ${sourcePath} to ${destinationPath}:`, error);
      throw new this.errorHandler.StorageError('Failed to move file: ' + 
        (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Delete a file from MinIO storage
   */
  async deleteFile(objectPath: string): Promise<boolean> {
    try {
      // Normalize path to ensure it doesn't start with a slash
      const normalizedPath = this.normalizePath(objectPath);
      
      this.logger.info(`Attempting to delete file from MinIO: ${normalizedPath}`);
      
      // Check if the file exists before attempting to delete
      let fileExists = false;
    try {
        await this.minioClient.statObject(this.bucketName, normalizedPath);
        fileExists = true;
        this.logger.debug(`File exists at path: ${normalizedPath}, proceeding with deletion`);
      } catch (statError: any) {
        if (statError.code === 'NotFound') {
          this.logger.warn(`File does not exist at path: ${normalizedPath}`);
        } else {
          this.logger.error(`Error checking file existence at ${normalizedPath}:`, statError);
        }
      }
      
      if (fileExists) {
        // Delete the file
        await this.minioClient.removeObject(this.bucketName, normalizedPath);
        this.logger.info(`File deleted from ${normalizedPath}`);
        return true;
      } else {
        // Try with alternative path formats
        const alternativePaths = [
          // Try without normalization
          objectPath,
          // Try with trailing slash
          normalizedPath + (normalizedPath.endsWith('/') ? '' : '/'),
          // Try without trailing slash
          normalizedPath.endsWith('/') ? normalizedPath.slice(0, -1) : normalizedPath
        ];
        
        let deleted = false;
        for (const altPath of alternativePaths) {
          if (altPath === normalizedPath) continue; // Skip the already tried path
          
          try {
            // Check if this alternative path exists
            try {
              await this.minioClient.statObject(this.bucketName, altPath);
              this.logger.debug(`Found file at alternative path: ${altPath}`);
            } catch (altStatError) {
              continue; // Skip to next path if this one doesn't exist
            }
            
            // Delete using this alternative path
            await this.minioClient.removeObject(this.bucketName, altPath);
            this.logger.info(`File deleted using alternative path: ${altPath}`);
            deleted = true;
            break;
          } catch (altError) {
            this.logger.debug(`Failed to delete using alternative path ${altPath}:`, altError);
            // Continue to next alternative path
          }
        }
        
        // Return success status instead of throwing error
        if (!deleted) {
          this.logger.warn(`File not found at path: ${normalizedPath} or any alternative paths`);
          return false;
        }
        return true;
      }
    } catch (error) {
      this.logger.error(`Error deleting file from storage at path ${objectPath}:`, error);
      // Return false to indicate failure
      return false;
    }
  }

  /**
   * Generate a presigned URL for file download
   */
  async getPresignedUrl(objectPath: string, expirySeconds: number = 3600): Promise<string> {
    try {
      return await this.minioClient.presignedGetObject(
        this.bucketName,
        objectPath, 
        expirySeconds
      );
    } catch (error) {
      throw new this.errorHandler.StorageError('Failed to generate download or preview URL');
    }
  }

  /**
   * Create a folder structure (empty object with trailing slash)
   */
  async createFolder(folderPath: string): Promise<void> {
    try {
      // Ensure path ends with a slash and normalize double slashes
      let normalizedPath = folderPath;
      if (!normalizedPath.endsWith('/')) {
        normalizedPath = `${normalizedPath}/`;
      }
      // Replace multiple consecutive slashes with a single slash (except at the beginning)
      normalizedPath = normalizedPath.replace(/([^:])\/+/g, '$1/');
      
      this.logger.debug(`Creating folder in MinIO at path: ${normalizedPath}`);
      
      // Check if bucket exists, create it if not
      const bucketExists = await this.minioClient.bucketExists(this.bucketName);
      if (!bucketExists) {
        this.logger.info(`Bucket ${this.bucketName} does not exist, creating it`);
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
      }
      
      // Check if the folder already exists first
      try {
        const stat = await this.minioClient.statObject(this.bucketName, normalizedPath);
        const contentType = stat.metaData?.['content-type'] || '';
        if (contentType === 'application/x-directory') {
          this.logger.debug(`Folder already exists at ${normalizedPath}, skipping creation`);
          return; // It's already a folder, no need to create it
        }
      } catch (statError) {
        // Folder doesn't exist, we'll create it (expected case)
        this.logger.debug(`Folder doesn't exist at ${normalizedPath}, will create it`);
      }
      
      // Create parent folders if they don't exist
      // Split path into segments and create each parent folder
      const pathParts = normalizedPath.split('/').filter(part => part.length > 0);
      let currentPath = '';
      
      // Create each parent folder in sequence
      for (let i = 0; i < pathParts.length; i++) {
        currentPath += `${pathParts[i]}/`;
        
        try {
          // Try to stat the current path to see if it exists
          await this.minioClient.statObject(this.bucketName, currentPath);
          this.logger.debug(`Path already exists: ${currentPath}`);
        } catch (statError) {
          // Path doesn't exist, create it
          this.logger.debug(`Creating intermediate path: ${currentPath}`);
          await this.minioClient.putObject(
            this.bucketName, 
            currentPath, 
            Buffer.from(''), 
            0,
            { 
              'Content-Type': 'application/x-directory',
              'x-amz-meta-object-type': 'folder'
            }
          );
          this.logger.debug(`Successfully created intermediate path: ${currentPath}`);
        }
      }
      
      // Create the final folder
      await this.minioClient.putObject(
        this.bucketName, 
        normalizedPath, 
        Buffer.from(''), 
        0,
        { 
          'Content-Type': 'application/x-directory',
          'x-amz-meta-object-type': 'folder'
        }
      );
      
      // Verify folder creation
      try {
        const stat = await this.minioClient.statObject(this.bucketName, normalizedPath);
        const contentType = stat.metaData?.['content-type'] || '';
        if (contentType === 'application/x-directory') {
          this.logger.debug(`Successfully created and verified folder: ${normalizedPath}`);
        } else {
          this.logger.warn(`Created object at ${normalizedPath} but wrong content type: ${contentType}`);
        }
      } catch (verifyError) {
        this.logger.error(`Failed to verify folder creation: ${normalizedPath}`, verifyError);
      }
    } catch (error) {
      throw new this.errorHandler.StorageError('Failed to create folder: ' + 
        (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Delete a folder and all its contents from MinIO storage
   */
  async deleteFolder(folderPath: string): Promise<void> {
    this.logger.info(`Deleting folder: ${folderPath}`);
    
    try {
      // Normalize path for MinIO
      const normalizedPath = this.normalizePath(folderPath) + (folderPath.endsWith('/') ? '' : '/');
      
      // Get list of all objects to delete
      const objectsToDelete: string[] = [];
      const objectsStream = this.minioClient.listObjectsV2(this.bucketName, normalizedPath, true);
      
      // Collect all objects
      await new Promise<void>((resolve, reject) => {
        objectsStream.on('data', (obj: any) => obj.name && objectsToDelete.push(obj.name));
        objectsStream.on('error', reject);
        objectsStream.on('end', resolve);
      });
      
      if (objectsToDelete.length === 0) {
        this.logger.info(`No objects found in folder ${normalizedPath}`);
        return;
      }
      
      this.logger.info(`Found ${objectsToDelete.length} objects to delete in folder ${normalizedPath}`);
      
      // Delete objects in batches of 1000 (MinIO's limit)
      const batchSize = 1000;
      for (let i = 0; i < objectsToDelete.length; i += batchSize) {
        const batch = objectsToDelete.slice(i, i + batchSize);
        try {
          await this.minioClient.removeObjects(this.bucketName, batch);
          this.logger.info(`Deleted batch of ${batch.length} objects (${i + 1}-${Math.min(i + batchSize, objectsToDelete.length)} of ${objectsToDelete.length})`);
        } catch (error) {
          this.logger.error(`Error in batch deletion, attempting individual deletions:`, error);
          // Fall back to individual deletion for this batch
          await Promise.allSettled(
            batch.map(async (objPath) => {
              try {
                await this.minioClient.removeObject(this.bucketName, objPath);
              } catch (err) {
                this.logger.error(`Failed to delete object ${objPath}:`, err);
              }
            })
          );
        }
      }
      
      // Delete the folder marker itself
      try {
        await this.minioClient.removeObject(this.bucketName, normalizedPath);
        this.logger.info(`Deleted folder marker: ${normalizedPath}`);
      } catch (error) {
        this.logger.debug(`No folder marker to delete at ${normalizedPath}`);
      }
      
      this.logger.info(`Successfully deleted folder ${folderPath} and its contents`);
    } catch (error) {
      this.logger.error(`Error deleting folder ${folderPath}:`, error);
    }
  }

  /**
   * Normalize a path for MinIO
   */
  private normalizePath(path: string): string {
    // Remove leading and trailing slashes
    let normalized = path.replace(/^\/+|\/+$/g, '');
    
    // Replace multiple consecutive slashes with a single slash
    normalized = normalized.replace(/\/+/g, '/');
    
    // Ensure the path doesn't start with a slash (MinIO requirement)
    return normalized;
  }

  /**
   * Check if a file exists in MinIO storage
   */
  async fileExists(objectPath: string): Promise<boolean> {
    try {
      // Normalize path to ensure it doesn't start with a slash
      const normalizedPath = this.normalizePath(objectPath);
      
      // Check if object exists
      await this.minioClient.statObject(this.bucketName, normalizedPath);
      
      this.logger.debug(`File exists: ${normalizedPath}`);
      return true;
    } catch (error: any) { // Type the error as any
      // Only log as warning if it's a "not found" error, otherwise log as error
      if (error.code === 'NotFound') {
        this.logger.debug(`File does not exist: ${objectPath}`);
      } else {
        this.logger.warn(`Error checking if file exists: ${objectPath}`, error);
      }
      return false;
    }
  }
}

// Export a singleton instance for easy access
export const storageHelper = StorageHelper.getInstance(); 