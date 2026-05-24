import postgres from "postgres"

function createSql() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set")
  }

  return postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  })
}

declare global {
  // eslint-disable-next-line no-var
  var __postgresClient: ReturnType<typeof postgres> | undefined
}

const sql = globalThis.__postgresClient ?? createSql()

if (process.env.NODE_ENV !== "production") {
  globalThis.__postgresClient = sql
}

export default sql
