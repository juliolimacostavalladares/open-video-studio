import { PrismaClient } from "@prisma/client";

const globalForDatabase = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const prisma =
  globalForDatabase.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.prisma = prisma;
}
