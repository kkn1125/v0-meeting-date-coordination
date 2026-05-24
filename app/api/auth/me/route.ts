import { NextRequest, NextResponse } from "next/server"
import { requireAuth, isAuthError } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthError(auth)) return auth

  return NextResponse.json({
    user: { id: auth.participantId, name: auth.name },
  })
}
