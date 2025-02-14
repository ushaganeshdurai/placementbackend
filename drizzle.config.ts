import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const schemas = [
  './src/db/schemas/staffSchema.ts', 
  './src/db/schemas/studentSchema.ts', 
  './src/db/schemas/superAdminSchema.ts'
];

export default defineConfig({
  out: './drizzle',
  schema: [...schemas],
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
