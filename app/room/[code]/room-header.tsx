"use client"

import { useState } from "react"
import Link from "next/link"
import type { Room } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { CalendarDays, Copy, Check, Users, Home } from "lucide-react"

interface RoomHeaderProps {
  room: Room
  participantCount: number
}

export function RoomHeader({ room, participantCount }: RoomHeaderProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(room.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/room/${room.code}`
    if (navigator.share) {
      await navigator.share({
        title: room.name,
        text: `"${room.name}" 모임에 참여해주세요!`,
        url,
      })
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <header className="border-b bg-card">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 rounded-md hover:bg-accent transition-colors">
              <Home className="h-5 w-5 text-muted-foreground" />
              <span className="sr-only">홈으로</span>
            </Link>
            
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-semibold text-foreground">{room.name}</h1>
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {participantCount}명 참여 중
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCode}
              className="gap-2 font-mono"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-available" />
                  복사됨
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  {room.code}
                </>
              )}
            </Button>
            <Button size="sm" onClick={handleShare}>
              공유하기
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
