import { pgTable, uuid, varchar, timestamp, boolean, integer, jsonb } from '../injections/configProvider';
import type { InferSelectModel, InferInsertModel } from '../injections/configProvider';
import { schemaProvider } from '../injections/schemaProvider';

export const files = pgTable('files', {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id').references(() => schemaProvider.getUserSchema().users.id, { onDelete: 'cascade' }).notNull(),
    objectName: varchar('object_name', { length: 255 }).notNull(),
    objectPath: varchar('object_path', { length: 1024 }).notNull(),
    objectType: varchar('object_type', { length: 150 }).notNull(),
    mimeType: varchar('mime_type', { length: 150 }),
    size: integer('size').notNull(),
    isFolder: boolean('is_folder').default(false).notNull(),
    isDeleted: boolean('is_deleted').default(false).notNull(),
    location: varchar('location', { length: 50, enum: ['Drive', 'Bin'] }).notNull().default('Drive'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    lastModified: timestamp('last_modified').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// For reading/selecting data from the database
export type File = InferSelectModel<typeof files>;
// For inserting new data into the database
export type NewFile = InferInsertModel<typeof files>;

// Register this schema with the provider
setTimeout(() => {
    schemaProvider.setFileSchema({ files });
}, 0);