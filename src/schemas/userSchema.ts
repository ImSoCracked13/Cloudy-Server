import { pgTable, uuid, varchar, timestamp, boolean, integer } from '../injections/configProvider';
import type { InferSelectModel, InferInsertModel } from '../injections/configProvider';
import { schemaProvider } from '../injections/schemaProvider';

// 5GB in bytes (5 * 1024 * 1024 * 1024)
const DEFAULT_STORAGE_LIMIT = 5368709120;

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    username: varchar('username', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    password: varchar('password', { length: 255 }),
    googleId: varchar('google_id', { length: 255 }),
    authProvider: varchar('auth_provider', { length: 10 }).notNull(),
    role: varchar('role', { length: 50 }).default('user').notNull(),
    isVerified: boolean('is_verified').default(false).notNull(),
    verificationToken: varchar('verification_token', { length: 255 }),
    verificationExpires: timestamp('verification_expires'),
    storageUsed: integer('storage_used').default(0).notNull(),
    storageLimit: integer('storage_limit').default(DEFAULT_STORAGE_LIMIT).notNull(),
    lastStorageUpdate: timestamp('last_storage_update'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// For reading/selecting data from the database
export type User = InferSelectModel<typeof users>;
// For inserting new data into the database
export type NewUser = InferInsertModel<typeof users>;

// Register this schema with the provider
setTimeout(() => {
    schemaProvider.setUserSchema({ users });
}, 0);
