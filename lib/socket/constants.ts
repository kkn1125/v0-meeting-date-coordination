/** Pages API bootstrap — attaches Socket.IO to the HTTP server. */
export const SOCKET_BOOTSTRAP_PATH = "/api/socket"

/** Engine.IO path — must differ from bootstrap (same path → 400 Transport unknown). */
export const SOCKET_IO_PATH = "/api/socket/io"
