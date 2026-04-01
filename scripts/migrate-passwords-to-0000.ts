import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env
  .SUPABASE_SERVICE_ROLE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다."
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // 1) 모든 participants id 가져오기 (soft delete는 제외하고 싶으면 deleted_at IS NULL 조건 추가)
  const { data: participants, error } = await supabase
    .from("participants")
    .select("id");
  // .is('deleted_at', null) // 필요하면 주석 해제

  if (error) {
    console.error("participants 조회 에러:", error);
    process.exit(1);
  }

  if (!participants || participants.length === 0) {
    console.log("업데이트할 participants가 없습니다.");
    return;
  }

  console.log(
    `총 ${participants.length}명의 비밀번호를 0000으로 초기화합니다.`
  );

  const newHash = await bcrypt.hash("0000", 10);

  // 2) 한번에 업데이트 (전부 같은 해시 사용)
  const { error: updateError } = await supabase
    .from("participants")
    .update({ password_hash: newHash })
    // .is('deleted_at', null) // 위와 동일 조건
    .neq("password_hash", newHash); // 이미 같은 해시인 경우는 생략 (옵션)

  if (updateError) {
    console.error("업데이트 에러:", updateError);
    process.exit(1);
  }

  console.log("비밀번호 초기화 완료!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
