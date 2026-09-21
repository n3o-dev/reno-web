import axios from 'axios'

/**
 * The one HTTP client.
 *
 * `withCredentials` so the session cookie travels; the cookie is httpOnly, so
 * this is the only way the browser can send it and no script can read it.
 */
export const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})
