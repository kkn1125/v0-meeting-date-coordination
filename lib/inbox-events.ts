export const INBOX_REFRESH_EVENT = "inbox:refresh"

export function requestInboxRefresh() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(INBOX_REFRESH_EVENT))
}
