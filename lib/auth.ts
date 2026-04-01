import bcrypt from "bcryptjs"
import type { SessionPayload } from "./types"

const SESSION_DURATION_MS = 30 * 60 * 1000 // 30 minutes

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function createSession(
  participantId: string,
  roomId: string,
  name: string,
  isHost: boolean
): SessionPayload {
  return {
    participantId,
    roomId,
    name,
    isHost,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  }
}

export function isSessionValid(session: SessionPayload | null): boolean {
  if (!session) return false
  return Date.now() < session.expiresAt
}

export function getSessionFromStorage(roomId: string): SessionPayload | null {
  if (typeof window === "undefined") return null
  
  const stored = localStorage.getItem(`session_${roomId}`)
  if (!stored) return null
  
  try {
    const session = JSON.parse(stored) as SessionPayload
    if (isSessionValid(session)) {
      return session
    }
    // Session expired, clean up
    localStorage.removeItem(`session_${roomId}`)
    return null
  } catch {
    return null
  }
}

export function setSessionToStorage(session: SessionPayload): void {
  if (typeof window === "undefined") return
  localStorage.setItem(`session_${session.roomId}`, JSON.stringify(session))
}

export function clearSessionFromStorage(roomId: string): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(`session_${roomId}`)
}

export function refreshSession(session: SessionPayload): SessionPayload {
  return {
    ...session,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  }
}
