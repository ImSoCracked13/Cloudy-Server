export type FileLocation = 'Drive' | 'Bin';

export const FileLocations = {
  DRIVE: 'Drive' as FileLocation,
  BIN: 'Bin' as FileLocation
} as const;

export interface File {
  id: string;
  ownerId: string;
  objectName: string;
  objectPath: string;
  objectType: string;
  mimeType: string | null;
  size: number;
  isFolder: boolean;
  isDeleted: boolean;
  location: FileLocation;
  parentId?: string | null;
  metadata: Record<string, unknown> | null;
  lastModified: Date;
  createdAt: Date;
  updatedAt: Date;
}
