import type { User } from '../schemas/userSchema';
import type { File } from '../schemas/fileSchema';

// Export type definitions directly for TypeScript compatibility
export type { User, File };

/**
 * Schema Provider for Dependency Injection
 */
export class SchemaProvider {
  private static instance: SchemaProvider;
  private userSchema: any = null;
  private fileSchema: any = null;

  private constructor() {}

  /**
   * Get the singleton instance of SchemaProvider
   */
  public static getInstance(): SchemaProvider {
    if (!SchemaProvider.instance) {
      SchemaProvider.instance = new SchemaProvider();
    }
    return SchemaProvider.instance;
  }

  /**
   * Set the user schema module
   */
  public setUserSchema(schema: any): void {
    this.userSchema = schema;
  }

  /**
   * Set the file schema module
   */
  public setFileSchema(schema: any): void {
    this.fileSchema = schema;
  }

  /**
   * Get user schema
   */
  public getUserSchema() {
    if (!this.userSchema) {
      // Dynamically import the schema to avoid circular dependencies
      const userSchemaPath = require.resolve('../schemas/userSchema');
      // Clear require cache to ensure we get the latest version
      delete require.cache[userSchemaPath];
      this.userSchema = require('../schemas/userSchema');
    }
    return this.userSchema;
  }

  /**
   * Get file schema
   */
  public getFileSchema() {
    if (!this.fileSchema) {
      // Dynamically import the schema to avoid circular dependencies
      const fileSchemaPath = require.resolve('../schemas/fileSchema');
      // Clear require cache to ensure we get the latest version
      delete require.cache[fileSchemaPath];
      this.fileSchema = require('../schemas/fileSchema');
    }
    return this.fileSchema;
  }

  public resetSchemas(): void {
    this.userSchema = null;
    this.fileSchema = null;
  }
}


export const schemaProvider = SchemaProvider.getInstance(); 