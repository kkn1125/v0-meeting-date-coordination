export { SESSION_DURATION_MS, AUTH_COOKIE_NAME } from "./constants"
export { hashPassword, verifyPassword } from "./password"
export { signAuthToken, verifyAuthToken, type AuthTokenPayload } from "./jwt"
export {
  getTokenFromRequest,
  getTokenFromCookieHeader,
  buildAuthCookie,
  buildClearAuthCookie,
  setAuthCookieOnResponse,
  clearAuthCookieOnResponse,
} from "./cookie"
export { verifyAuthFromRequest, verifyAuthFromCookieHeader } from "./verify"
export {
  requireAuth,
  requireRoomMember,
  isAuthError,
  type AuthenticatedUser,
  type RoomAuthenticatedUser,
} from "./guards"
export { getSocketNotifySecret, isValidSocketNotifyRequest } from "./notify"
