export const MENTION_TOKEN_REGEX = /@\[([^\]]+)\]\(([0-9a-f-]+)\)/g

export function serializeMention(name: string, participantId: string): string {
  return `@[${name}](${participantId})`
}

export function extractMentionParticipantIds(content: string): string[] {
  const ids = new Set<string>()
  const regex = new RegExp(MENTION_TOKEN_REGEX.source, "g")
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    ids.add(match[2])
  }
  return [...ids]
}

export function stripMentionTokens(content: string): string {
  return content.replace(MENTION_TOKEN_REGEX, "").replace(/\s+/g, " ").trim()
}

export type MemoContentPart =
  | { type: "text"; value: string }
  | { type: "mention"; name: string; participantId: string }

export function parseMemoContent(content: string): MemoContentPart[] {
  const parts: MemoContentPart[] = []
  const regex = new RegExp(MENTION_TOKEN_REGEX.source, "g")
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: content.slice(lastIndex, match.index) })
    }
    parts.push({
      type: "mention",
      name: match[1],
      participantId: match[2],
    })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", value: content.slice(lastIndex) })
  }

  return parts
}
