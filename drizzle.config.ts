import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const schemas = [
  './src/db/schemas/staffSchema.ts',
  './src/db/schemas/studentSchema.ts',
  './src/db/schemas/superAdminSchema.ts',
  './src/db/schemas/users.ts',
  './src/db/schemas/applicationsSchema.ts',
  './src/db/schemas/coordinatorsSchema.ts',
  './src/db/schemas/driveSchema.ts',
  './src/db/schemas/groupMailSchema.ts',
  './src/db/schemas/eventSchema.ts',
];

export default defineConfig({
  out: './drizzle',
  schema: [...schemas],
  dialect: 'postgresql',
  dbCredentials: {
    // url: process.env.DATABASE_URL!,
    host: 'localhost',
    port: 54322,
    user: 'postgres',
    ssl:false,
    password: 'postgres',
    database: 'postgres',
  },
  schemaFilter: ["public"]
});
