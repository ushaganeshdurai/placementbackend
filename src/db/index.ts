import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import env from "@/env";

const client = postgres(env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);

export default db;
