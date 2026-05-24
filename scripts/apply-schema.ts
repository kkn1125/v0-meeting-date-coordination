import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import sql from "../lib/db";

async function main() {
  const schemaPath = join(__dirname, "init_schema.sql");
  const schema = readFileSync(schemaPath, "utf-8");

  await sql.unsafe(schema);

  const tables = await sql<{ table_name: string }[]>`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
  ORDER BY table_name
  `;

  console.log("스키마 적용 완료. 테이블 목록:");
  for (const row of tables) {
    console.log(`  - ${row.table_name}`);
  }
}

main()
  .catch((error) => {
    console.error("스키마 적용 실패:", error);
    process.exit(1);
  })
  .finally(() => sql.end());
