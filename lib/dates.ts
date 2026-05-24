import { isValid, parse } from "date-fns"

const ISO_DATE_RE = /^(\d{4}-\d{2}-\d{2})/
/** Legacy bug: String(Date).slice(0, 10) → "Mon May 04" */
const LEGACY_LOCALE_DATE_RE = /^[A-Za-z]{3} [A-Za-z]{3} \d{2}$/

function formatDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * DB/driver date values → `yyyy-MM-dd` for parseISO on the client.
 * postgres.js maps PostgreSQL `date` to JS Date; String(date).slice(0, 10) is locale text like "Mon May 04".
 */
export function toISODateString(value: unknown): string {
  if (value == null || value === "") return ""

  if (typeof value === "string") {
    const match = value.match(ISO_DATE_RE)
    if (match) return match[1]
    if (LEGACY_LOCALE_DATE_RE.test(value)) {
      const parsed = parse(value, "EEE MMM dd", new Date())
      if (isValid(parsed)) return formatDateLocal(parsed)
    }
    return value
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateLocal(value)
  }

  return String(value)
}

/** timestamptz 등 → ISO 문자열 (parseISO용) */
export function toISOStringValue(value: unknown): string {
  if (value == null || value === "") return ""
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString()
  }
  if (typeof value === "string") return value
  return String(value)
}
