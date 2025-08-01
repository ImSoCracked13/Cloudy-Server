import { Readable } from 'stream';
import { repositoryProvider } from '../injections/repositoryProvider';
import { utilityProvider } from '../injections/utilityProvider';

type File = any;
type FileLocation = 'Drive' | 'Bin';
type FileMetadata = any;
type FilePreviewResult = any;
type PreviewType = 'image' | 'text' | 'pdf' | 'audio' | 'video' | 'other';

export class FileService {
  private storageHelper;
  private logger;
  private fileTracker;
  private cacheHandler;

  constructor() {
    this.storageHelper = utilityProvider.getStorageHelper();
    this.logger = utilityProvider.getLogger();
    this.fileTracker = utilityProvider.getFileTracker();
    this.cacheHandler = utilityProvider.getCacheHandler();
  }

  /**
   * Upload a file
   */
  async uploadFile(
    ownerId: string,
    fileBuffer: Buffer,
    metadata: FileMetadata,
    size: number,
    path: string = '/'
  ): Promise<File> {
    try {
      // Normalize path
      let normalizedPath = path;
      if (!normalizedPath.startsWith('/')) {
        normalizedPath = '/' + normalizedPath;
      }
      if (normalizedPath === '') {
        normalizedPath = '/';
      }
    
      // Check for filename conflicts
      const fileRepository = repositoryProvider.getFileRepository();
      const existingFile = await fileRepository.findByNameAndPath(ownerId, metadata.name, normalizedPath, 'Drive');
      
      if (existingFile) {
        this.logger.error(`File "${metadata.name}" already exists at this location`);
        return null;
      }
    
      // Get user's base storage path
      const userBasePath = await this.getUserStorageBasePath(ownerId);
    
      // Build storage path
      let storagePath = '';
      if (normalizedPath === '/') {
        storagePath = `${userBasePath}Drive/${metadata.name}`;
      } else {
        // Ensure path starts with a slash for consistency
        const pathWithoutLeadingSlash = normalizedPath.startsWith('/') ? normalizedPath.substring(1) : normalizedPath;
        storagePath = `${userBasePath}Drive/${pathWithoutLeadingSlash}${metadata.name}`;
      }
      
      this.logger.info(`Uploading file "${metadata.name}" to path ${storagePath}`);
      
      // Upload file to storage
      await this.storageHelper.uploadFile(
        storagePath,
        fileBuffer,
        size,
        {
          'Content-Type': metadata.mime_type || 'application/octet-stream',
          'x-amz-meta-owner-id': ownerId,
          'x-amz-meta-object-type': 'file'
        }
      );
      
      // Create file record in database
      const fileData = {
        ownerId,
        objectName: metadata.name,
        objectPath: normalizedPath,
        objectType: metadata.type || 'file',
        mimeType: metadata.mime_type || 'application/octet-stream',
        size,
        isFolder: false,
        location: 'Drive' as FileLocation,
        metadata: {
          ...metadata,
          'x-amz-meta-object-type': 'file'
        },
        lastModified: new Date()
      };

      this.logger.info(`Creating file record for "${metadata.name}" in database`);

      // File Upload Size Limit Check
      if (size > 25 * 1024 * 1024) { // Limit to 25MB
        this.logger.error(`File "${metadata.name}" exceeds size limit (25MB): ${size} bytes`);
        return null;
      }

      // Usage limit exceeded check passing 5GB
      const userStorageUsage = await fileRepository.calculateStorageUsed(ownerId);
      if (userStorageUsage + size > 5 * 1024 * 1024 * 1024) { // Limit to 5GB
        this.logger.error(`User storage limit exceeded (5GB): current usage is ${userStorageUsage} bytes`);
        return null;
      }

      // Create file record in database
      let file = await fileRepository.createFile(fileData);
      this.logger.info(`Created new file record: ${file.id}`);

      if (!file) {
        throw new Error('Failed to create file record in database');
      }

      // Update storage usage
      await this.updateUserStorageUsage(ownerId);
      
      // Invalidate cache for the file's parent directory
      await this.fileTracker.invalidateOwnerCache(ownerId, 'drive');
      
      return file;
    } catch (error) {
      this.logger.error(`Error uploading file "${metadata.name}" for user ${ownerId}:`, error);
      throw error;
    }
  }

  /**
   * Preview a file
   */
  async previewFile(fileId: string, userId: string): Promise<FilePreviewResult> {
    
    // Force a fresh fetch from the database to ensure we have the latest file data
    await this.cacheHandler.deleteFromCache(`file:${fileId}`);
    
    // Get file record and its latest data
    const file = await this.getFileById(fileId);
    
    if (!file) {
        this.logger.warn(`File not found: ${fileId}`);
    }
    
      this.logger.debug(`Found file for preview: ${file.objectName} (ID: ${fileId})`);
    
      // Check ownership
    if (file.ownerId !== userId) {
        this.logger.warn(`Access denied to file ${fileId} for user ${userId}`);
      }
      
      // Determine preview type based on mime type
      let previewType: PreviewType = 'other';
      let content: string = '';
      let url: string = '';
      
      try {
      if (file.mimeType) {
        if (file.mimeType.startsWith('image/')) {
          previewType = 'image';
          url = await this.getFileUrl(fileId, userId);
        } else if (file.mimeType.startsWith('text/') || 
                   file.mimeType.includes('json') ||
                   file.mimeType.includes('javascript') ||
                   file.mimeType.includes('xml')) {
          previewType = 'text';
          const { fileStream } = await this.downloadFile(fileId, userId);
          const chunks: Buffer[] = [];
          
          for await (const chunk of fileStream) {
            chunks.push(Buffer.from(chunk));
          }
          
          content = Buffer.concat(chunks).toString('utf-8');
        } else if (file.mimeType === 'application/pdf') {
          previewType = 'pdf';
          url = await this.getFileUrl(fileId, userId);
        } else if (file.mimeType.startsWith('audio/')) {
          previewType = 'audio';
          url = await this.getFileUrl(fileId, userId);
        } else if (file.mimeType.startsWith('video/')) {
          previewType = 'video';
          url = await this.getFileUrl(fileId, userId);
        }
      }
      
      // Track preview
      await this.fileTracker.incrementFileStat(fileId, 'previews');
        
      this.logger.debug(`Generated preview for file ${fileId}, type: ${previewType}`);
      
      return {
        type: previewType,
        url,
        name: file.objectName,
        size: file.size,
        content: content || undefined
      };
    } catch (error) {
        this.logger.error(`Error generating preview for file ${fileId}:`, error);
    }
  }

  /**
   * Download a file
   */
  async downloadFile(fileId: string, userId: string): Promise<{ fileStream: Readable; file: File; metadata: Record<string, string> }> {
    
    // Force a fresh fetch from the database to ensure we have the latest file data
    await this.cacheHandler.deleteFromCache(`file:${fileId}`);
    
    // Get file record and its latest data
    const file = await this.getFileById(fileId);
    
    if (!file) {
        throw new Error('File not found');
    }
    
      this.logger.debug(`Found file for download: ${file.objectName} (ID: ${fileId})`);
    
    // Check ownership
    if (file.ownerId !== userId) {
        throw new Error('Access denied');
    }
    
    // Get user's base storage path
    const userBasePath = await this.getUserStorageBasePath(file.ownerId);
    
    // Prepare storage path using user's base path
      const storagePath = file.objectPath === '/' 
        ? `${userBasePath}${file.location}/${file.objectName}` 
        : `${userBasePath}${file.location}/${file.objectPath === '/' ? '' : file.objectPath.replace(/^\/+/, '')}/${file.objectName}`;
        
      this.logger.debug(`Storage path for file download: ${storagePath}`);
      
      try {
        // Get file stream and metadata
        const { stream, metadata } = await this.storageHelper.downloadFile(storagePath);
        this.logger.debug(`File stream and metadata retrieved: ${storagePath}`);
        
        // Track download
        await this.fileTracker.incrementFileStat(fileId, 'downloads');
        await this.fileTracker.incrementUserStat(userId, 'fileDownloads');
        
        return { fileStream: stream, file, metadata };
    } catch (error) {
        throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Rename a file
   */
  async renameFile(fileId: string, newName: string): Promise<File> {
    
    // Force a fresh fetch from the database to ensure we have the latest file data
      await this.cacheHandler.deleteFromCache(`file:${fileId}`);
    
      // Get file record and its latest data
    const file = await this.getFileById(fileId);
    
    if (!file) {
      this.logger.warn(`File not found: ${fileId}`);
    }
    
      // Check if name is the same
      if (file.objectName === newName) {
        this.logger.debug(`File ${fileId} already has the name "${newName}"`);
      return file;
    }
    
      // Ensure file extension is preserved
      if (!file.isFolder) {
        const originalName = file.objectName;
        // Check if original file has an extension
        if (originalName.includes('.') && !originalName.startsWith('.')) {
          const originalExtension = originalName.substring(originalName.lastIndexOf('.'));
          // If new name doesn't end with the same extension, add it
          if (!newName.endsWith(originalExtension)) {
            // Only add extension if new name doesn't already have one
            if (!newName.includes('.') || newName.lastIndexOf('.') <= newName.lastIndexOf('/')) {
              this.logger.debug(`Adding extension ${originalExtension} to new name ${newName}`);
              newName = newName + originalExtension;
            }
          }
        }
      }
      
      // Check for name conflicts in the same path
      const fileRepository = repositoryProvider.getFileRepository();
      const existingFile = await fileRepository.findByNameAndPath(
        file.ownerId,
        newName,
        file.objectPath,
        file.location
      );
      
      if (existingFile) {
        throw new Error(`A file named "${newName}" already exists in this location`);
      }
      
      // Get user's base storage path
    const userBasePath = await this.getUserStorageBasePath(file.ownerId);
    
      // Rename the file in MinIO storage
      if (!file.isFolder) {
        try {
        // Calculate source path
        const sourcePath = file.objectPath === '/' 
          ? `${userBasePath}${file.location}/${file.objectName}` 
          : `${userBasePath}${file.location}/${file.objectPath.startsWith('/') ? file.objectPath.substring(1) : file.objectPath}/${file.objectName}`;
        
          // Calculate destination path with new filename but same location
          const destPath = file.objectPath === '/' 
            ? `${userBasePath}${file.location}/${newName}` 
            : `${userBasePath}${file.location}/${file.objectPath.startsWith('/') ? file.objectPath.substring(1) : file.objectPath}/${newName}`;
        
          this.logger.debug(`Renaming file in storage from ${sourcePath} to ${destPath}`);
        
          // Check if source file exists
          const sourceExists = await this.storageHelper.fileExists(sourcePath);
          if (!sourceExists) {
            this.logger.warn(`Source file does not exist at ${sourcePath}, will only update database record`);
          } else {
            // Use the renameFile method which properly implements rename as copy+delete
            await this.storageHelper.renameFile(sourcePath, destPath);
            this.logger.debug(`File renamed in MinIO from ${sourcePath} to ${destPath}`);
          }
          
          // Update file record with new name
        const updatedFile = await repositoryProvider.getFileRepository().updateFile(fileId, {
          objectName: newName,
          objectPath: file.objectPath, // Keep the same path, only name changes
        updatedAt: new Date()
      });
      
      if (!updatedFile) {
          this.logger.error('Failed to rename file');
      }
      
      // Invalidate caches to ensure updated data is fetched
        await this.fileTracker.invalidateOwnerCache(file.ownerId, file.location.toLowerCase() as 'drive' | 'bin');
      
      // Wait a moment to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get the updated file to ensure we return the most recent data
      const refreshedFile = await this.getFileById(fileId);
      if (!refreshedFile) {
          this.logger.warn(`Could not retrieve renamed file ${fileId} after update`);
      return updatedFile;
      }
      
          this.logger.info(`File ${fileId} successfully renamed from "${file.objectName}" to "${refreshedFile.objectName}"`);
      return refreshedFile;
    } catch (error) {
          this.logger.error(`Error renaming file in storage:`, error);
        }
    }
  }

  /**
   * Duplicate a file
   */
  async duplicateFile(fileId: string): Promise<File> {
    
    // Force a fresh fetch from the database to ensure we have the latest file data
    await this.cacheHandler.deleteFromCache(`file:${fileId}`);
    
    // Get file record and its latest data
    const file = await this.getFileById(fileId);
    
    if (!file) {
      this.logger.warn(`File not found: ${fileId}`);
    }
    
    this.logger.debug(`Found file for duplication: ${file.objectName} (ID: ${fileId})`);
    
    // Check if the file has an extension
    const fileName = file.objectName;
    const lastDotIndex = fileName.lastIndexOf('.');
    const hasExtension = lastDotIndex > 0 && lastDotIndex < fileName.length - 1 && !file.isFolder;
    
    let baseName: string;
    let extension: string = '';
    
    if (hasExtension) {
      baseName = fileName.substring(0, lastDotIndex);
      extension = fileName.substring(lastDotIndex);
    } else {
      baseName = fileName;
    }
    
    // Get existing files in the same path
    const existingFiles = await repositoryProvider.getFileRepository().findByPath(file.ownerId, file.objectPath, file.location);
    
    // Find the highest copy number for this file
    const copyNumbers = existingFiles
      .map(f => {
        // For files with extension, match pattern like "filename (1).ext"
        if (hasExtension) {
          const baseWithoutExt = f.objectName.substring(0, f.objectName.lastIndexOf('.'));
          const match = baseWithoutExt.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\((\\d+)\\)$`));
        return match && match[1] ? parseInt(match[1]) : 0;
        } else {
          // For files without extension, match pattern like "filename (1)"
          const match = f.objectName.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\((\\d+)\\)$`));
          return match && match[1] ? parseInt(match[1]) : 0;
        }
      })
      .filter(n => n > 0);
    
    const copyNumber = copyNumbers.length > 0 ? Math.max(...copyNumbers) + 1 : 1;
    
    // Generate new name with increment before extension
    const newName = hasExtension 
      ? `${baseName} (${copyNumber})${extension}`
      : `${baseName} (${copyNumber})`;

    this.logger.debug(`Generated unique filename for duplicate: ${newName}`);

    // Create new file record
    const newFile = await repositoryProvider.getFileRepository().createFile({
      ownerId: file.ownerId,
      objectName: newName,
      objectPath: file.objectPath,
      objectType: file.objectType,
      mimeType: file.mimeType,
      size: file.size,
      isFolder: file.isFolder,
      location: file.location,
      metadata: file.metadata || {}, // Ensure metadata is never null
      lastModified: new Date()
    });

    if (!newFile || !newFile.id) {
      this.logger.error(`Failed to create database record for duplicate of ${fileId}`);
    }

    this.logger.debug(`Created database record for duplicate file: ${newFile.id}`);

    // Copy file in storage
    if (!file.isFolder) {
      try {
        // Get user's base storage path
        const userBasePath = await this.getUserStorageBasePath(file.ownerId);
        
        // Construct full source and destination paths
        const sourcePath = file.objectPath === '/' 
          ? `${userBasePath}${file.location}/${file.objectName}` 
          : `${userBasePath}${file.location}/${file.objectPath === '/' ? '' : file.objectPath.replace(/^\/+/, '')}/${file.objectName}`;
          
        const destPath = newFile.objectPath === '/' 
          ? `${userBasePath}${newFile.location}/${newFile.objectName}` 
          : `${userBasePath}${newFile.location}/${newFile.objectPath === '/' ? '' : newFile.objectPath.replace(/^\/+/, '')}/${newFile.objectName}`;
        
        await this.storageHelper.duplicateFile(sourcePath, destPath);
        this.logger.debug(`File copied successfully in storage`);
        
        // Invalidate caches to ensure updated data is fetched
        await this.fileTracker.invalidateOwnerCache(file.ownerId, file.location === 'Drive' ? 'drive' : 'bin');

      } catch (error) {
        // Delete the database record if storage copy failed
        try {
          await repositoryProvider.getFileRepository().deleteFile(newFile.id);
          this.logger.debug(`Deleted database record ${newFile.id} due to storage copy failure`);
        } catch (deleteError) {
          this.logger.error(`Failed to delete database record after storage copy failure: ${deleteError instanceof Error ? deleteError.message : 'Unknown error'}`);
        }
        
        this.logger.error(`Failed to copy file in storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Update storage usage
    await this.updateUserStorageUsage(file.ownerId);

    return newFile;
  }

  /**
   * Move a file to Bin
   */
  async moveToBin(fileId: string): Promise<File> {
    
    try {
      // Force a fresh fetch from the database to ensure we have the latest file data
      await this.cacheHandler.deleteFromCache(`file:${fileId}`);
      
      // Get file record and its latest data
      const file = await this.getFileById(fileId);
      
      if (!file) {
        throw new Error('File not found');
      }
      
      this.logger.debug(`Found file for Bin: ${file.objectName} (ID: ${fileId})`);
      
      // Check if already in trash - if so, just return the file without error
      if (file.location === 'Bin') {
        this.logger.info(`File ${fileId} is already in Bin, no action needed`);
        return file;
      }
      
      // Get user base path
      const userBasePath = await this.getUserStorageBasePath(file.ownerId);
      
      // Move file in MinIO storage
      if (!file.isFolder) {
        // Construct source and destination paths properly for a file
        const sourceObjectPath = file.objectPath === '/' 
          ? `${userBasePath}Drive/${file.objectName}` 
          : `${userBasePath}Drive/${file.objectPath.startsWith('/') ? file.objectPath.substring(1) : file.objectPath}${file.objectPath.endsWith('/') ? '' : '/'}${file.objectName}`;
        
        const destObjectPath = file.objectPath === '/' 
          ? `${userBasePath}Bin/${file.objectName}` 
          : `${userBasePath}Bin/${file.objectPath.startsWith('/') ? file.objectPath.substring(1) : file.objectPath}${file.objectPath.endsWith('/') ? '' : '/'}${file.objectName}`;
        
        this.logger.debug(`Moving file in storage from ${sourceObjectPath} to ${destObjectPath}`);
        
        // Check if destination already exists
        const destExists = await this.storageHelper.fileExists(destObjectPath);
        if (destExists) {
          this.logger.info(`Destination file already exists at ${destObjectPath}, will overwrite`);
          // Delete the destination file first to avoid conflicts
          await this.storageHelper.deleteFile(destObjectPath);
        }
        
        // Ensure the Bin folder exists
        const binFolder = `${userBasePath}Bin/`;
        const binExists = await this.storageHelper.fileExists(binFolder);
        if (!binExists) {
          await this.storageHelper.createFolder(binFolder);
        }
        
        // Move the file in MinIO
        await this.storageHelper.moveFile(sourceObjectPath, destObjectPath);
      } 
      
      // Update file record in database
      const fileRepository = repositoryProvider.getFileRepository();

      // Stop the moving file if there is a same name file in Bin
      const existingFileInBin = await fileRepository.findByNameAndPath(file.ownerId, file.objectName, file.objectPath, 'Bin');
      if (existingFileInBin) {
        this.logger.error(`File "${file.objectName}" with same name already exists in Bin, cannot move to Bin`);
        throw new Error(`File "${file.objectName}" with same name already exists in Bin, cannot move to Bin`);
      }

      const updatedFile = await fileRepository.updateFile(fileId, {
        location: 'Bin',
        updatedAt: new Date()
      });

      
      if (!updatedFile) {
        throw new Error('Failed to update file record in database');
      }
      
      // Invalidate caches to ensure updated data is fetched
      await this.fileTracker.invalidateOwnerCache(file.ownerId, 'drive');
      await this.fileTracker.invalidateOwnerCache(file.ownerId, 'bin');
      
      // Clear specific file cache to ensure fresh data
      await this.cacheHandler.deleteFromCache(`file:${fileId}`);
      
      // Return the updated file directly from database update (has correct location)
      this.logger.info(`File ${fileId} successfully moved to trash. Location: ${updatedFile.location}`);
      return updatedFile;
    } catch (error) {
      this.logger.error(`Error moving file ${fileId} to trash:`, error);
    }
  }

  /**
   * Restore a file from Bin
   */
  async restoreFile(fileId: string): Promise<File> {
      
      // Force a fresh fetch from the database to ensure we have the latest file data
      await this.cacheHandler.deleteFromCache(`file:${fileId}`);
      
      // Get file record and its latest data
      const file = await this.getFileById(fileId);
      
      if (!file) {
        this.logger.warn(`File not found: ${fileId}`);
      }
      
      this.logger.debug(`Found file for restore: ${file.objectName} (ID: ${fileId})`);
      
      // If file is already in Drive, just return it without error
      if (file.location === 'Drive') {
        this.logger.info(`File ${fileId} is already in Drive, no action needed`);
        return file;
      }
      
      // Allow restoring from any location, but default to Drive if not in Bin
      const targetLocation = file.location === 'Bin' ? 'Drive' : 'Drive';

      // Get user base path
      const userBasePath = await this.getUserStorageBasePath(file.ownerId);
      
      try {
        // Move file in MinIO storage
        if (!file.isFolder) {
          // Construct source and destination paths properly for a file
          const sourceObjectPath = file.objectPath === '/' 
            ? `${userBasePath}${file.location}/${file.objectName}` 
            : `${userBasePath}${file.location}/${file.objectPath.startsWith('/') ? file.objectPath.substring(1) : file.objectPath}${file.objectName}`;
          
          const destObjectPath = file.objectPath === '/' 
            ? `${userBasePath}${targetLocation}/${file.objectName}` 
            : `${userBasePath}${targetLocation}/${file.objectPath.startsWith('/') ? file.objectPath.substring(1) : file.objectPath}${file.objectName}`;
          
          this.logger.debug(`Restoring file in storage from ${sourceObjectPath} to ${destObjectPath}`);
          
          // Check if destination already exists
          const destExists = await this.storageHelper.fileExists(destObjectPath);
          if (destExists) {
            this.logger.info(`Destination file already exists at ${destObjectPath}, will overwrite`);
            // Delete the destination file first to avoid conflicts
            await this.storageHelper.deleteFile(destObjectPath);
          }
          
          // Ensure the Drive folder exists
          const driveFolder = `${userBasePath}${targetLocation}/`;
          const driveExists = await this.storageHelper.fileExists(driveFolder);
          if (!driveExists) {
            await this.storageHelper.createFolder(driveFolder);
          }
          
          // Move the file in MinIO
          await this.storageHelper.moveFile(sourceObjectPath, destObjectPath);
        }
        
        // Update file record in database
        const fileRepository = repositoryProvider.getFileRepository();

        // Stop the restoring file if there is a same name file in Drive
        const existingFileInDrive = await fileRepository.findByNameAndPath(file.ownerId, file.objectName, file.objectPath, 'Drive');
        if (existingFileInDrive) {
          this.logger.error(`File "${file.objectName}" with same name already exists in Drive, cannot restore from Bin`);
          return null;
        }
        const updatedFile = await fileRepository.updateFile(fileId, {
          location: targetLocation,
          updatedAt: new Date()
        });
        
        if (!updatedFile) {
          throw new Error('Failed to update file record in database');
        }
        
        // Invalidate caches to ensure updated data is fetched
        await this.fileTracker.invalidateOwnerCache(file.ownerId, file.location === 'Drive' ? 'drive' : 'bin');
        await this.fileTracker.invalidateOwnerCache(file.ownerId, targetLocation === 'Drive' ? 'drive' : 'bin');
        
        // Clear specific file cache to ensure fresh data
        await this.cacheHandler.deleteFromCache(`file:${fileId}`);
        
        // Return the updated file directly from database update (has correct location)
        this.logger.info(`File ${fileId} successfully restored from bin. Location: ${updatedFile.location}`);
        return updatedFile;
      } catch (error) {
        this.logger.error(`Error restoring file ${fileId} from bin:`, error);
      }
  }

  /**
   * Delete a file permanently from the bin
   */
  async deleteFileForever(fileId: string, userId: string): Promise<void> {
    
    try {
      // Force a fresh fetch from the database to ensure we have the latest file data
      await this.cacheHandler.deleteFromCache(`file:${fileId}`);
      
      // Verify file exists and user owns it
      const file = await this.getFileById(fileId);
      
      if (!file) {
        throw new Error('File not found');
      }
      
      if (file.ownerId !== userId) {
        throw new Error('Access denied');
      }

      // Only allow deletion of files that are in the bin
      if (file.location !== 'Bin') {
        this.logger.warn(`File ${fileId} is not in Bin, cannot delete permanently`);
        return;
      }

      this.logger.info(`File found for deletion: ${fileId}, name: ${file.objectName}, path: ${file.objectPath}`);
      
      // Get user's base storage path
      const userBasePath = await this.getUserStorageBasePath(file.ownerId);
      
      // Build the storage path
      const storagePath = file.objectPath === '/' 
        ? `${userBasePath}Bin/${file.objectName}${file.isFolder ? '/' : ''}` 
        : `${userBasePath}Bin/${file.objectPath.startsWith('/') ? file.objectPath.substring(1) : file.objectPath}${file.objectPath.endsWith('/') ? '' : '/'}${file.objectName}${file.isFolder ? '/' : ''}`;
      
      this.logger.info(`Attempting to delete file from storage: ${storagePath}`);

      // Delete from storage
      const success = await this.storageHelper.deleteFile(storagePath);
      if (!success) {
        this.logger.warn(`File not found in storage at path: ${storagePath}`);
      }
      
      // Delete from database
      const fileRepository = repositoryProvider.getFileRepository();
      await fileRepository.deleteFile(fileId);
      this.logger.info(`File record deleted from database: ${fileId}`);
      
      // Invalidate cache
      await this.fileTracker.invalidateOwnerCache(file.ownerId, 'bin');
      
      // Update storage usage
      await this.updateUserStorageUsage(file.ownerId);
      
      this.logger.info(`File ${fileId} deleted successfully`);
    } catch (error) {
      this.logger.error(`Error deleting file ${fileId}:`, error);
    }
  }

  /**
   * Empty the bin for a user
   */
  async emptyBin(userId: string): Promise<void> {

      // Force a fresh fetch from the database to ensure we have the latest file data
      await this.cacheHandler.deleteFromCache(`user:${File}`);

      // Get all files in bin
      const fileRepository = repositoryProvider.getFileRepository();
      const files = await fileRepository.findByPath(userId, '/', 'Bin');
      
      // Get user's base storage path
      const userBasePath = await this.getUserStorageBasePath(userId);
      
      // Delete all files from storage
      for (const file of files) {
        if (!file.isFolder) {
          // Properly construct the storage path to avoid double slashes
          let storagePath;
          if (file.objectPath === '/') {
            storagePath = `${userBasePath}Bin/${file.objectName}`;
          } else {
            // Normalize path to avoid double slashes
            const normalizedPath = file.objectPath.startsWith('/') ? 
              file.objectPath.substring(1) : file.objectPath;
            storagePath = `${userBasePath}Bin/${normalizedPath}${normalizedPath && !normalizedPath.endsWith('/') ? '/' : ''}${file.objectName}`;
          }
          
          try {
            this.logger.debug(`Attempting to delete file from storage: ${storagePath}`);
            await this.storageHelper.deleteFile(storagePath);
          } catch (error) {
            this.logger.error(`Error deleting file ${file.id} from storage:`, error);
          }
        }
      }
      
    // Delete all files from database
    await fileRepository.deleteAllFiles(userId);
      
    // Invalidate cache
    await this.fileTracker.invalidateOwnerCache(userId, 'bin');
      
    // Update storage usage
    await this.updateUserStorageUsage(userId); 
  }

  /**
   * Get storage statistics for a user
   */
  async getStorageStats(userId: string): Promise<{ storageUsed: number; storageLimit: number; fileCount: number }> {
    try {
      const fileRepository = repositoryProvider.getFileRepository();
      const userRepository = repositoryProvider.getUserRepository();
      
      // Get current storage usage
      const storageUsed = await fileRepository.calculateStorageUsed(userId);
      
      // Get user's storage limit
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Get file count
      const fileCount = await fileRepository.getFileCount(userId);
      
      return {
        storageUsed,
        storageLimit: user.storageLimit || 5368709120, // Default to 5GB
        fileCount
      };
    } catch (error) {
      this.logger.error('Error getting storage stats:', error);
      throw error;
    }
  }

  /**
   * Create initial folder structure for a new user
   */
  async createInitialFolderStructure(userId: string, isGoogleUser: boolean = false): Promise<void> {
    
    try {
      this.logger.info(`Creating folder structure for user ${userId} (${isGoogleUser ? 'Google' : 'Local'} user)`);
      
      // Ensure the MinIO folders exist first
      try {
        const baseFolder = isGoogleUser ? 'Google Users' : 'Local Users';
        
        // Create required MinIO folders for both Google and Local users
        await this.storageHelper.createFolder(`${baseFolder}/`);
        await this.storageHelper.createFolder(`${baseFolder}/${userId}/`);
        await this.storageHelper.createFolder(`${baseFolder}/${userId}/Drive/`);
        await this.storageHelper.createFolder(`${baseFolder}/${userId}/Bin/`);
        
        this.logger.info(`Created or verified MinIO folders for user ${userId} in ${baseFolder}/`);
      } catch (minioError) {
        this.logger.error(`Error creating MinIO folders, will continue anyway:`, minioError);
      }
      
      // Check if the Drive and Bin folders already exist in database
      const fileRepository = repositoryProvider.getFileRepository();
      
      // Check Drive folder
      const existingDriveFiles = await fileRepository.findByPath(userId, '/', 'Drive');
      this.logger.info(`Found ${existingDriveFiles.length} existing Drive files`);
      
      const existingDriveFolder = existingDriveFiles.find(f => f.isFolder && f.objectPath === '/');
      if (existingDriveFolder) {
        this.logger.info(`Drive folder record already exists for user ${userId}`);
      } else {
        this.logger.warn(`No Drive folder record found for user ${userId}, creating one`);
      }
      
      // Check Bin folder
      const existingBinFiles = await fileRepository.findByPath(userId, '/', 'Bin');
      this.logger.info(`Found ${existingBinFiles.length} existing Bin files`);
      
      const existingBinFolder = existingBinFiles.find(f => f.isFolder && f.objectPath === '/');
      if (existingBinFolder) {
        this.logger.info(`Bin folder record already exists for user ${userId}`);
      } else {
        this.logger.warn(`No Bin folder record found for user ${userId}, creating one`);
      }
      
      // Create Drive folder record in database
      if (!existingDriveFolder) {
        this.logger.info(`Creating Drive folder record for user ${userId}`);
        const driveFolderData = {
          ownerId: userId,
          objectName: '', // Use empty name for root folder
          objectPath: '/',
          objectType: 'folder',
          mimeType: 'application/x-directory',
          size: 0,
          isFolder: true,
          location: 'Drive' as FileLocation,
          metadata: {
            'x-amz-meta-object-type': 'folder',
            'is-google-user': isGoogleUser ? 'true' : 'false'
          },
          lastModified: new Date()
        };
        
        try {
          await fileRepository.createFile(driveFolderData);
          this.logger.info(`Created Drive folder record for user ${userId}`);
        } catch (driveError) {
          this.logger.error(`Error creating Drive folder record: ${driveError instanceof Error ? driveError.message : 'Unknown error'}`);
        }
      } else {
        this.logger.info(`Drive folder record already exists for user ${userId}`);
      }
      
      // Create Bin folder record in database
      if (!existingBinFolder) {
        this.logger.info(`Creating Bin folder record for user ${userId}`);
        const binFolderData = {
          ownerId: userId,
          objectName: '', // Use empty name for root folder
          objectPath: '/',
          objectType: 'folder',
          mimeType: 'application/x-directory',
          size: 0,
          isFolder: true,
          location: 'Bin' as FileLocation,
          metadata: {
            'x-amz-meta-object-type': 'folder',
            'is-google-user': isGoogleUser ? 'true' : 'false'
          },
          lastModified: new Date()
        };
        
        try {
          await fileRepository.createFile(binFolderData);
          this.logger.info(`Created Bin folder record for user ${userId}`);
        } catch (binError) {
          this.logger.error(`Error creating Bin folder record: ${binError instanceof Error ? binError.message : 'Unknown error'}`);
        }
      } else {
        this.logger.info(`Bin folder record already exists for user ${userId}`);
      }
      
      this.logger.info(`Successfully created and verified folder structure for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error creating folder structure for user ${userId}:`, error);
    }
  }

  /**
   * Get files by path
   */
  async getFilesByPath(
    ownerId: string, 
    path: string, 
    location: FileLocation = 'Drive',
  ): Promise<File[]> {
    
    // Normalize path to ensure consistency
    let normalizedPath = path.startsWith('/') ? path : `/${path}`;
    normalizedPath = normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`;
    
    // Get files from database
    const fileRepository = repositoryProvider.getFileRepository();
    const files = await fileRepository.findByPath(ownerId, normalizedPath, location);
    
    this.logger.debug(`Found ${files.length} files in database for path ${normalizedPath}`);
    
    // Filter out any files that don't match the exact location and path
    const filteredFiles = files.filter(file => {
      // Check if file's location matches the requested location
      if (file.location !== location) {
        this.logger.debug(`Filtering out file ${file.id} (${file.objectName}) with location ${file.location} from ${location} view`);
        return false;
      }
      
      // Filter out empty-named files
        if (!file.objectName || file.objectName.trim() === '') {
        this.logger.debug(`Filtering out empty-named item ${file.id}`);
        return false;
      }
      
      // For root path, include files directly in root and folders with self-named paths
      if (normalizedPath === '/') {
        if (file.objectPath === '/' || file.objectPath === '') {
          return true;
        }
        return false;
      }
      
      return file.objectPath === normalizedPath;
    });
    
    return filteredFiles;
  }

  /**
   * Get a file URL for preview
   */
  async getFileUrl(fileId: string, userId: string): Promise<string> {
    
    // Force a fresh fetch from the database to ensure we have the latest file data
    await this.cacheHandler.deleteFromCache(`file:${fileId}`);
    
    // Get file record and its latest data then save it to cache
    const file = await this.getFileById(fileId);
    
    if (!file) {
      this.logger.warn(`File not found: ${fileId}`);
    }
    
    this.logger.debug(`Found file for URL generation: ${file.objectName} (ID: ${fileId})`);
    
    // Check ownership or public access
    if (file.ownerId !== userId) {
      this.logger.warn(`Access denied to file ${fileId} for user ${userId}`);
    }
    
    try {
      // Get user's base storage path
      const userBasePath = await this.getUserStorageBasePath(file.ownerId);
      
      // Prepare storage path using user's base path
      const storagePath = file.objectPath === '/' 
        ? `${userBasePath}${file.location}/${file.objectName}` 
        : `${userBasePath}${file.location}/${file.objectPath === '/' ? '' : file.objectPath.replace(/^\/+/, '')}/${file.objectName}`;
        
      this.logger.debug(`Storage path for file URL: ${storagePath}`);
      
      // Get presigned URL
      const url = await this.storageHelper.getPresignedUrl(storagePath, 3600); // 1 hour expiry
      
      // Track URL generation
      await this.fileTracker.incrementFileStat(fileId, 'urlGenerations');
      
      return url;
      } catch (error) {
      throw new Error(`Failed to generate URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a file by ID with cache
   */
  async getFileById(fileId: string): Promise<File | null> {
    // Try to get from cache first
    const cacheKey = `file:${fileId}`;
    const cachedFile = await this.cacheHandler.getFromCache<File>(cacheKey);
    
    if (cachedFile) {
      return cachedFile;
    }
    
    // Get from database if not in cache
    const fileRepository = repositoryProvider.getFileRepository();
    const file = await fileRepository.findById(fileId);
    
    if (file) {
      // Cache the file
      await this.cacheHandler.setInCache(cacheKey, file, this.cacheHandler.CACHE_TTL.FILE_LIST);
      return file;
    }
    
    this.logger.warn(`File not found: ${fileId}`);
    return null;
  }

  /**
   * Get the base storage path for a user based on their auth provider
   */
  private async getUserStorageBasePath(userId: string): Promise<string> {
    try {
      // Get user details to determine auth provider
      const userRepository = repositoryProvider.getUserRepository();
      const user = await userRepository.findById(userId);
      
      if (!user) {
        throw new Error(`User not found with ID ${userId}`);
      }
      
      // Determine base path based on auth provider
      const baseFolder = user.authProvider === 'google' ? 'Google Users' : 'Local Users';
      return `${baseFolder}/${userId}/`;
        } catch (error) {
      this.logger.error(`Error getting storage base path for user ${userId}:`, error);
      // Default to Local Users if there's an error
      return `Local Users/${userId}/`;
    }
  }

  /**
   * Update a user's storage usage statistics
   */
  private async updateUserStorageUsage(userId: string): Promise<void> {
    try {
      const fileRepository = repositoryProvider.getFileRepository();
      const userRepository = repositoryProvider.getUserRepository();
      
      // Calculate current storage usage from files table
      const currentUsage = await fileRepository.calculateStorageUsed(userId);
      
      // Update user record with current usage
      await userRepository.updateStorageUsed(userId, currentUsage);
      
      this.logger.debug(`Updated storage usage for user ${userId}: ${currentUsage} bytes`);
    } catch (err) {
      this.logger.error(`Error updating storage usage for user ${userId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }
}