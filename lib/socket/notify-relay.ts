import type { NextRequest } from "next/server"
import { headers } from "next/headers"
import { broadcastInboxMany } from "@/lib/socket/broadcast"
import { getIO } from "@/lib/socket/io"

const NOTIFY_PATH = "/api/socket/notify"

function getDefaultNotifyUrl() {
  const port = process.env.PORT || "3000"
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://127.0.0.1:${port}`)
  return `${base.replace(/\/$/, "")}${NOTIFY_PATH}`
}

async function resolveNotifyUrl(request?: Request | NextRequest) {
  if (request) {
    const host =
      request.headers.get("x-forwarded-host") ?? request.headers.get("host")
    const proto = request.headers.get("x-forwarded-proto") ?? "http"
    if (host) return `${proto}://${host}${NOTIFY_PATH}`
  }

  try {
    const h = await headers()
    const host = h.get("x-forwarded-host") ?? h.get("host")
    const proto = h.get("x-forwarded-proto") ?? "http"
    if (host) return `${proto}://${host}${NOTIFY_PATH}`
  } catch {
    // outside App Router request scope
  }

  return getDefaultNotifyUrl()
}

async function postNotify(
  payload: Record<string, unknown>,
  request?: Request | NextRequest
) {
  const url = await resolveNotifyUrl(request)
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    console.error("Socket notify relay failed:", res.status, body)
  }
}

async function publishInbox(recipientIds: string[], request?: Request | NextRequest) {
  const unique = [...new Set(recipientIds)].filter(Boolean)
  if (unique.length === 0) return

  const io = getIO()
  if (io) {
    await broadcastInboxMany(unique)
    return
  }

  await postNotify({ type: "inbox", recipientIds: unique }, request)
}

export async function notifyRoomMemosUpdated(
  roomId: string,
  recipientIds: string[] = [],
  request?: Request | NextRequest
) {
  const io = getIO()
  if (io) {
    const { broadcastRoomMemos } = await import("@/lib/socket/broadcast")
    await broadcastRoomMemos(roomId, recipientIds)
    return
  }

  await postNotify(
    {
      type: "memos",
      roomId,
      recipientIds,
    },
    request
  )
}

export async function notifyInboxUpdated(
  recipientIds: string[],
  request?: Request | NextRequest
) {
  await publishInbox(recipientIds, request)
}
