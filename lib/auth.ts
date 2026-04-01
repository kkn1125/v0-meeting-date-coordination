import bcrypt from "bcryptjs"
import type { SessionPayload, GlobalSessionPayload } from "./types"

const SESSION_DURATION_MS = 30 * 60 * 1000 // 30 minutes
const GLOBAL_SESSION_KEY = "global_session_v1"

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

export function createGlobalSession(name: string): GlobalSessionPayload {
  return {
    name,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  }
}

export function isSessionValid(session: { expiresAt: number } | null): boolean {
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

export function getGlobalSessionFromStorage(): GlobalSessionPayload | null {
  if (typeof window === "undefined") return null

  const stored = localStorage.getItem(GLOBAL_SESSION_KEY)
  if (!stored) return null

  try {
    const session = JSON.parse(stored) as GlobalSessionPayload
    if (isSessionValid(session)) {
      return session
    }
    localStorage.removeItem(GLOBAL_SESSION_KEY)
    return null
  } catch {
    return null
  }
}

export function setGlobalSessionToStorage(session: GlobalSessionPayload): void {
  if (typeof window === "undefined") return
  localStorage.setItem(GLOBAL_SESSION_KEY, JSON.stringify(session))
}

export function clearGlobalSessionFromStorage(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(GLOBAL_SESSION_KEY)
}
