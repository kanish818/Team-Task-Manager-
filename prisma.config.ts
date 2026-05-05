import { defineConfig } from "prisma/config";

const databaseUrlForConfig =
  process.env.DATABASE_URL ??
  "postgresql://prisma:prisma@127.0.0.1:5432/prisma?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: databaseUrlForConfig,
  },
  migrations: {
    path: "prisma/migrations",
  },
});
