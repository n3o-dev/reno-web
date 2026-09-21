/**
 * The cookie name, alone in its own module.
 *
 * Middleware runs on the edge runtime, where `node:crypto` does not exist —
 * importing it from the session module would pull scrypt in with it and fail
 * the build. A constant with no imports can be shared by both.
 */
export const SESSION_COOKIE = 'reno_session'
