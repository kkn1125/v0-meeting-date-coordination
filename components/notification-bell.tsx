"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { ko } from "date-fns/locale"
import { Bell, CheckCheck, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getGlobalSessionFromStorage } from "@/lib/auth"
import { INBOX_REFRESH_EVENT } from "@/lib/inbox-events"
import type { InboxNotification } from "@/lib/types"
import { useInboxSocket } from "@/hooks/use-inbox-socket"
import { cn } from "@/lib/utils"

export function NotificationBell() {
  const router = useRouter()
  const [sessionName, setSessionName] = useState<string | null>(null)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<InboxNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const session = getGlobalSessionFromStorage()
    setSessionName(session?.name ?? null)
  }, [])

  const loadInbox = useCallback(async () => {
    if (!sessionName) return
    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/inbox?participantName=${encodeURIComponent(sessionName)}`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setNotifications(data.notifications ?? [])
      setUnreadCount(data.unreadCount ?? 0)
      setParticipantId(data.participantId ?? null)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }, [sessionName])

  useEffect(() => {
    void loadInbox()
  }, [loadInbox])

  useEffect(() => {
    const handleRefresh = () => {
      void loadInbox()
    }
    window.addEventListener(INBOX_REFRESH_EVENT, handleRefresh)
    return () => window.removeEventListener(INBOX_REFRESH_EVENT, handleRefresh)
  }, [loadInbox])

  useInboxSocket(participantId, loadInbox)

  if (!sessionName) return null

  const toggleRead = async (notification: InboxNotification) => {
    if (!participantId) return
    await fetch(`/api/inbox/${notification.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantId,
        isRead: !notification.is_read,
      }),
    })
    void loadInbox()
  }

  const markAllRead = async () => {
    if (!participantId) return
    await fetch("/api/inbox/read-all", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId }),
    })
    void loadInbox()
  }

  const deleteNotification = async (id: string) => {
    if (!participantId) return
    await fetch(`/api/inbox/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId }),
    })
    void loadInbox()
  }

  const navigateToNotification = (notification: InboxNotification) => {
    if (!notification.room_code) return
    const params = new URLSearchParams({
      dateRangeId: notification.date_range_id,
      memoId: notification.memo_id,
    })
    setOpen(false)
    router.push(`/room/${notification.room_code}?${params.toString()}`)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed right-4 top-4 z-50 h-9 w-9 rounded-full shadow-sm"
          aria-label="알림"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">알림</p>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={markAllRead}>
              <CheckCheck className="h-3.5 w-3.5" />
              전체 읽음
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">불러오는 중...</p>
          ) : notifications.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">알림이 없습니다.</p>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "space-y-1 p-3",
                    !notification.is_read && "bg-muted/40"
                  )}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => navigateToNotification(notification)}
                  >
                    <p className="text-sm font-medium">{notification.room_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {notification.mentioner_name}님이 멘션 ·{" "}
                      {notification.start_date &&
                        format(parseISO(notification.start_date), "M/d", {
                          locale: ko,
                        })}
                      ~
                      {notification.end_date &&
                        format(parseISO(notification.end_date), "M/d", {
                          locale: ko,
                        })}
                    </p>
                    {notification.memo_preview && (
                      <p className="mt-1 line-clamp-2 text-xs">{notification.memo_preview}</p>
                    )}
                  </button>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => toggleRead(notification)}
                    >
                      {notification.is_read ? "안읽음" : "읽음"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive"
                      onClick={() => deleteNotification(notification.id)}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      삭제
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
