import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const schemas = [
  '@/db/schemas/staffSchema.ts',
  '@/db/schemas/studentSchema.ts',
  '@/db/schemas/superAdminSchema.ts',
  '@/db/schemas/users.ts',
  '@/db/schemas/applicationsSchema.ts',
  '@/db/schemas/coordinatorsSchema.ts',
  '@/db/schemas/driveSchema.ts',
  '@/db/schemas/groupMailSchema.ts',
  '@/db/schemas/eventSchema.ts',
  '@/db/schemas/'

];

export default defineConfig({
  out: './drizzle',
  schema: [...schemas],
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ["public"]
});
