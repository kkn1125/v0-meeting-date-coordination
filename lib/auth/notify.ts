export function getSocketNotifySecret(): string | undefined {
  return process.env.SOCKET_NOTIFY_SECRET
}

export function isValidSocketNotifyRequest(
  secretHeader: string | string[] | undefined
): boolean {
  const secret = getSocketNotifySecret()
  if (!secret) return false
  const value = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader
  return value === secret
}
