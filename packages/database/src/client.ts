import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForDatabase = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const getPrismaClient = (): PrismaClient => {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  const originalDisconnect = client.$disconnect.bind(client);
  client.$disconnect = async () => {
    await originalDisconnect();
    await pool.end();
  };

  return client;
};

export const prisma = globalForDatabase.prisma ?? getPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.prisma = prisma;
}
