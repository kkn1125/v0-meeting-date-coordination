import type { NextRequest, NextResponse } from "next/server"
import { AUTH_COOKIE_NAME, SESSION_DURATION_MS } from "./constants"
import { signAuthToken } from "./jwt"

function isSecureCookie(): boolean {
  return process.env.NODE_ENV === "production"
}

export function getTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(AUTH_COOKIE_NAME)?.value ?? null
}

export function getTokenFromCookieHeader(
  cookieHeader: string | undefined
): string | null {
  if (!cookieHeader) return null

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=")
    if (name === AUTH_COOKIE_NAME) {
      const value = rest.join("=")
      return value ? decodeURIComponent(value) : null
    }
  }
  return null
}

export function buildAuthCookie(token: string): string {
  const maxAge = Math.floor(SESSION_DURATION_MS / 1000)
  const secure = isSecureCookie() ? "; Secure" : ""
  return `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

export function buildClearAuthCookie(): string {
  const secure = isSecureCookie() ? "; Secure" : ""
  return `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
}

export async function setAuthCookieOnResponse(
  response: NextResponse,
  participantId: string
): Promise<NextResponse> {
  const token = await signAuthToken(participantId)
  response.headers.append("Set-Cookie", buildAuthCookie(token))
  return response
}

export function clearAuthCookieOnResponse(response: NextResponse): NextResponse {
  response.headers.append("Set-Cookie", buildClearAuthCookie())
  return response
}
