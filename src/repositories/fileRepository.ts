import { configProvider, and, eq, or, sql } from '../injections/configProvider';
import { schemaProvider } from '../injections/schemaProvider';
import { File, FileLocation } from '../injections/typeProvider';

export class FileRepository {
  /**
   * Create a new file record in the database
   */
  static async createFile(fileData: any): Promise<File> {
    try {
      const db = configProvider.getDatabase();
      const { files } = schemaProvider.getFileSchema();
      
      // Handle metadata properly before insertion
      let processedMetadata = null;
      if (fileData.metadata !== undefined && fileData.metadata !== null) {
        if (typeof fileData.metadata === 'string') {
          try {
            // Try to parse if it's a JSON string
            processedMetadata = JSON.parse(fileData.metadata);
          } catch (error) {
            // Store it as a string if parsing fails
            processedMetadata = { value: fileData.metadata };
          }
        } else if (typeof fileData.metadata === 'object') {
          // Check if its an object
          processedMetadata = fileData.metadata;
        }
      }
      
      // Create the insert data with proper defaults
      const insertData = {
        ...fileData,
        objectName: fileData.objectName || '',
        objectPath: fileData.objectPath || '/',
        objectType: fileData.objectType || 'folder',
        mimeType: fileData.mimeType || 'application/x-directory',
        size: fileData.size || 0,
        isFolder: fileData.isFolder !== undefined ? fileData.isFolder : false,
        isDeleted: fileData.isDeleted !== undefined ? fileData.isDeleted : false,
        location: fileData.location || 'Drive',
        metadata: processedMetadata,
        lastModified: fileData.lastModified || new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Insert the record
      const results = await db.insert(files).values(insertData).returning();
      
      // Handle potential array or object result from Drizzle ORM
      const file = Array.isArray(results) && results.length > 0 
        ? results[0] 
        : (results as any);
      
      if (!file) {
        throw new Error('Failed to create file record');
      }
      
      // Return the created file with metadata
      return {
        ...file,
        metadata: file.metadata
      } as File;
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update a file's properties
   */
  static async updateFile(id: string, fileData: Partial<File>): Promise<File | undefined> {
    const db = configProvider.getDatabase();
    const { files } = schemaProvider.getFileSchema();
    
    // Handle metadata serialization
    const updateData: Record<string, any> = {
      ...fileData,
      updatedAt: new Date(),
      metadata: fileData.metadata ? JSON.stringify(fileData.metadata) : null
    };
      
    // Remove undefined values to prevent SQL errors
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
      
    const [updatedFile] = await db
      .update(files)
      .set(updateData)
      .where(eq(files.id, id))
      .returning();
      
      // Parse metadata back to object if it exists
      if (updatedFile && updatedFile.metadata) {
        try {
          updatedFile.metadata = JSON.parse(updatedFile.metadata as string);
        } catch (error) {
          throw new Error('Failed to parse metadata JSON');
        }
      }
      
      return updatedFile as File | undefined;
    }

  /**
   * Permanently delete a file
   */
  static async deleteFile(id: string): Promise<File | undefined> {
    const db = configProvider.getDatabase();
    const { files } = schemaProvider.getFileSchema();
    
    const result = await db
      .delete(files)
      .where(eq(files.id, id))
      .returning();
      
    const deletedFile = Array.isArray(result) ? result[0] : result;
    return deletedFile as File | undefined;
  }

  /**
   * Delete all files in bin permanently
   */
  static async deleteAllFiles(ownerId: string): Promise<File[]> {
    const db = configProvider.getDatabase();
    const { files } = schemaProvider.getFileSchema();
    
    // First, find the root bin folder
    const rootBinFolder = await db
      .select()
      .from(files)
      .where(
        and(
          eq(files.ownerId, ownerId),
          eq(files.location, 'Bin'),
          eq(files.objectPath, '/'),
          eq(files.isFolder, true)
        )
      )
      .limit(1);
    
    // Delete all files in bin except the root bin folder
    const result = await db
      .delete(files)
      .where(
        and(
          eq(files.ownerId, ownerId),
          eq(files.location, 'Bin'),
          // Only delete files that are not the root bin folder
          sql`${files.id} != ${rootBinFolder[0]?.id ?? '00000000-0000-0000-0000-000000000000'}`
        )
      )
      .returning();
      
    return (Array.isArray(result) ? result : [result]) as File[];
  }

  /**
   * Delete all files owned by a user
   */
  static async deleteAllFilesByUserId(userId: string): Promise<number> {
    try {
      const db = configProvider.getDatabase();
      const { files } = schemaProvider.getFileSchema();
      
      // First get a count of files to be deleted
      const fileCount = await db
        .select({ count: sql`count(*)` })
        .from(files)
        .where(eq(files.ownerId, userId));
      
      // Get actual count from result
      const count = parseInt(fileCount[0]?.count?.toString() || '0');
      
      if (count === 0) {
        return 0;
      }
      
      // Delete all files for this user
          await db
            .delete(files)
        .where(eq(files.ownerId, userId));
      
      return count;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find a file by its ID
   */
  static async findById(id: string): Promise<File | undefined> {
    const db = configProvider.getDatabase();
    const { files } = schemaProvider.getFileSchema();
    const [file] = await db.select().from(files).where(eq(files.id, id));
    return file as File | undefined;
  }

  /**
   * Find files by path and location
   */
  static async findByPath(ownerId: string, path: string, location: FileLocation): Promise<File[]> {
    const db = configProvider.getDatabase();
    const { files } = schemaProvider.getFileSchema();
    
    // Ensure the path starts with a slash for consistency
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    // Perform the query for the specific path in creation order
    const results = await db
      .select()
      .from(files)
      .where(
        and(
          eq(files.ownerId, ownerId),
          eq(files.objectPath, normalizedPath),
          eq(files.location, location),
          eq(files.isDeleted, false)
        )
      )
      .orderBy(files.createdAt);
    
    return results as File[];
  }

  /**
   * Find a file by name and path in a specific location
   */
  static async findByNameAndPath(ownerId: string, fileName: string, path: string, location: FileLocation): Promise<File | undefined> {
    const db = configProvider.getDatabase();
    const { files } = schemaProvider.getFileSchema();
    
    // Ensure the path starts with a slash for consistency
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    const [file] = await db
      .select()
      .from(files)
      .where(
        and(
          eq(files.ownerId, ownerId),
          eq(files.objectName, fileName),
          eq(files.objectPath, normalizedPath),
          eq(files.location, location),
          eq(files.isDeleted, false)
        )
      )
      .limit(1);
    
    return file as File | undefined;
  }

  /**
   * Get total file count for a user
   */
  static async getFileCount(ownerId: string): Promise<number> {
    const db = configProvider.getDatabase();
    const { files } = schemaProvider.getFileSchema();
    const result = await db
    
      .select({ count: sql<number>`count(*)` })
      .from(files)
      .where(
        and(
          eq(files.ownerId, ownerId),
          eq(files.isDeleted, false),
          eq(files.isFolder, false)
        )
      );
      
    return result[0]?.count || 0;
  }

  /**
   * Calculate total storage used by a user
   */
  static async calculateStorageUsed(ownerId: string): Promise<number> {
    const db = configProvider.getDatabase();
    const { files } = schemaProvider.getFileSchema();
    const result = await db
      .select({ total: files.size })
      .from(files)
      .where(
        and(
          eq(files.ownerId, ownerId),
          eq(files.isDeleted, false),
          or(
            eq(files.location, 'Drive'),
            eq(files.location, 'Bin')
            )
          )
        );
    return result.reduce((sum: number, row) => sum + (row.total || 0), 0);
  }
} 