import "dotenv/config";
import sql from "../lib/db";
import { hashPassword } from "../lib/auth";

async function main() {
  const participants = await sql<
    { id: string; name: string; password_hash: string | null }[]
  >`
    SELECT id, name, password_hash FROM participants
  `;

  if (participants.length === 0) {
    console.log("마이그레이션할 참가자가 없습니다.");
    return;
  }

  const passwordHash = await hashPassword("0000");

  const ids = participants
    .filter((p) => !p.password_hash)
    .map((p) => p.id);

  if (ids.length === 0) {
    console.log("비밀번호가 없는 참가자가 없습니다.");
    return;
  }

  await sql`
    UPDATE participants
    SET password_hash = ${passwordHash}
    WHERE id = ANY(${ids})
  `;

  console.log(`${ids.length}명의 비밀번호를 0000으로 설정했습니다.`);
}

main()
  .catch(console.error)
  .finally(() => sql.end());
