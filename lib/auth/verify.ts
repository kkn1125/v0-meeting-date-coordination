import type { NextRequest } from "next/server"
import { getTokenFromCookieHeader, getTokenFromRequest } from "./cookie"
import { verifyAuthToken, type AuthTokenPayload } from "./jwt"

export async function verifyAuthFromRequest(
  request: NextRequest
): Promise<AuthTokenPayload | null> {
  const token = getTokenFromRequest(request)
  if (!token) return null
  return verifyAuthToken(token)
}

export async function verifyAuthFromCookieHeader(
  cookieHeader: string | undefined
): Promise<AuthTokenPayload | null> {
  const token = getTokenFromCookieHeader(cookieHeader)
  if (!token) return null
  return verifyAuthToken(token)
}
