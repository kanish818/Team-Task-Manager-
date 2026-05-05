import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaPool?: Pool;
};

let prismaSingleton: PrismaClient | undefined;

function getPool(): Pool {
  if (globalForPrisma.prismaPool) return globalForPrisma.prismaPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({ connectionString });
  globalForPrisma.prismaPool = pool;
  return pool;
}

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  if (prismaSingleton) return prismaSingleton;

  const client = new PrismaClient({
    adapter: new PrismaPg(getPool()),
    log: ["error", "warn"],
  });

  prismaSingleton = client;
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, receiver) as unknown;
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
