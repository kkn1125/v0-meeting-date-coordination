"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { serializeMention } from "@/lib/memo-content"
import { cn } from "@/lib/utils"

export interface MentionParticipant {
  id: string
  name: string
}

type Segment =
  | { type: "text"; value: string }
  | { type: "mention"; name: string; participantId: string }

interface MentionInputProps {
  participants: MentionParticipant[]
  value: string
  onChange: (content: string, mentionIds: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

function segmentsToContent(segments: Segment[]): string {
  return segments
    .map((seg) =>
      seg.type === "text"
        ? seg.value
        : serializeMention(seg.name, seg.participantId)
    )
    .join("")
}

function segmentsToMentionIds(segments: Segment[]): string[] {
  return segments
    .filter((s): s is Extract<Segment, { type: "mention" }> => s.type === "mention")
    .map((s) => s.participantId)
}

function contentToSegments(content: string): Segment[] {
  const regex = /@\[([^\]]+)\]\(([0-9a-f-]+)\)/g
  const segments: Segment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, match.index) })
    }
    segments.push({
      type: "mention",
      name: match[1],
      participantId: match[2],
    })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) })
  }

  if (segments.length === 0) {
    segments.push({ type: "text", value: "" })
  }

  return segments
}

export function MentionInput({
  participants,
  value,
  onChange,
  placeholder = "메모를 입력하세요. @로 멘션할 수 있습니다.",
  disabled = false,
  className,
}: MentionInputProps) {
  const [segments, setSegments] = useState<Segment[]>(() => contentToSegments(value))
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [editingMentionIndex, setEditingMentionIndex] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSegments(contentToSegments(value))
  }, [value])

  const emitChange = useCallback(
    (next: Segment[]) => {
      onChange(segmentsToContent(next), segmentsToMentionIds(next))
    },
    [onChange]
  )

  const filteredParticipants = useMemo(() => {
    const q = query.toLowerCase()
    return participants.filter((p) => p.name.toLowerCase().includes(q))
  }, [participants, query])

  const updateTextSegment = (text: string) => {
    setSegments((prev) => {
      const next = [...prev]
      const textIdx = next.findIndex((s) => s.type === "text")
      if (textIdx >= 0) {
        next[textIdx] = { type: "text", value: text }
      } else {
        next.push({ type: "text", value: text })
      }
      emitChange(next)
      return next
    })
  }

  const insertMention = (participant: MentionParticipant, replaceIndex?: number) => {
    setSegments((prev) => {
      let next = [...prev]

      if (replaceIndex !== undefined) {
        next[replaceIndex] = {
          type: "mention",
          name: participant.name,
          participantId: participant.id,
        }
      } else {
        const textIdx = next.findIndex((s) => s.type === "text")
        const currentText =
          textIdx >= 0 && next[textIdx].type === "text" ? next[textIdx].value : ""
        const atIndex = currentText.lastIndexOf("@")

        if (atIndex >= 0) {
          const before = currentText.slice(0, atIndex)
          const after = currentText.slice(atIndex).replace(/^@[^\s]*/, "")
          const mentions = next.filter((s) => s.type === "mention") as Extract<
            Segment,
            { type: "mention" }
          >[]
          next = [...mentions]
          if (before) next.push({ type: "text", value: before })
          next.push({
            type: "mention",
            name: participant.name,
            participantId: participant.id,
          })
          if (after) next.push({ type: "text", value: after })
        } else {
          next.push({
            type: "mention",
            name: participant.name,
            participantId: participant.id,
          })
          if (!next.some((s) => s.type === "text")) {
            next.push({ type: "text", value: "" })
          }
        }
      }

      emitChange(next)
      return next
    })
    setShowSuggestions(false)
    setQuery("")
    setEditingMentionIndex(null)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleInputChange = (text: string) => {
    const atMatch = text.match(/@([^\s@]*)$/)
    if (atMatch) {
      setShowSuggestions(true)
      setQuery(atMatch[1])
      setSelectedIndex(0)
    } else {
      setShowSuggestions(false)
      setQuery("")
    }
    updateTextSegment(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && filteredParticipants.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % filteredParticipants.length)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex(
          (i) => (i - 1 + filteredParticipants.length) % filteredParticipants.length
        )
        return
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault()
        insertMention(filteredParticipants[selectedIndex])
        return
      }
      if (e.key === "Escape") {
        setShowSuggestions(false)
        return
      }
    }

    const currentText = segments.find((s) => s.type === "text")?.value ?? ""

    if (e.key === "Backspace" && currentText === "") {
      const mentionIndices = segments
        .map((s, i) => (s.type === "mention" ? i : -1))
        .filter((i) => i >= 0)
      const lastMentionIdx = mentionIndices[mentionIndices.length - 1]
      if (lastMentionIdx !== undefined) {
        e.preventDefault()
        setSegments((prev) => {
          const next = prev.filter((_, i) => i !== lastMentionIdx)
          if (!next.some((s) => s.type === "text")) {
            next.push({ type: "text", value: "" })
          }
          emitChange(next)
          return next
        })
      }
    }
  }

  const textValue = segments.find((s) => s.type === "text")?.value ?? ""

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          disabled && "pointer-events-none opacity-50"
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {segments.map((seg, index) =>
          seg.type === "mention" ? (
            <Badge
              key={`mention-${index}-${seg.participantId}`}
              variant="secondary"
              className="cursor-pointer select-none px-1.5 py-0.5 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                setEditingMentionIndex(index)
                setShowSuggestions(true)
                setQuery("")
                setSelectedIndex(0)
              }}
            >
              [{seg.name}]
            </Badge>
          ) : null
        )}
        <input
          ref={inputRef}
          type="text"
          value={textValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={segments.some((s) => s.type === "mention") ? "" : placeholder}
          disabled={disabled}
          className="min-w-[120px] flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>

      {showSuggestions && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover shadow-md">
          <Command shouldFilter={false}>
            <CommandList>
              <CommandEmpty>참여자를 찾을 수 없습니다.</CommandEmpty>
              <CommandGroup heading="참여자">
                {filteredParticipants.map((p, i) => (
                  <CommandItem
                    key={p.id}
                    value={p.name}
                    onSelect={() =>
                      insertMention(p, editingMentionIndex ?? undefined)
                    }
                    className={cn(i === selectedIndex && "bg-accent")}
                  >
                    {p.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  )
}
