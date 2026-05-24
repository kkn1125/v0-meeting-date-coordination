import { SignJWT, jwtVerify } from "jose"
import { SESSION_DURATION_MS } from "./constants"

export interface AuthTokenPayload {
  sub: string
  iat: number
  exp: number
}

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET is not configured")
  }
  return new TextEncoder().encode(secret)
}

export async function signAuthToken(participantId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + Math.floor(SESSION_DURATION_MS / 1000)

  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(participantId)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(getSecretKey())
}

export async function verifyAuthToken(
  token: string
): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    })

    if (typeof payload.sub !== "string" || !payload.sub) {
      return null
    }

    const iat = typeof payload.iat === "number" ? payload.iat : 0
    const exp = typeof payload.exp === "number" ? payload.exp : 0

    return { sub: payload.sub, iat, exp }
  } catch {
    return null
  }
}
