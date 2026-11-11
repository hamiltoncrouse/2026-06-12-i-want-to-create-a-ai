import { timingSafeEqual } from 'node:crypto'

// Operator-only tools (voice diagnostics, jingle generation) spend paid API
// credits and are not part of the listener app, so they stay off unless
// AIRBREAK_ADMIN_TOKEN is set and the caller presents it, either as an
// "x-admin-token" header or a "token" query parameter.
export function isAdminRequest(req) {
  const expected = process.env.AIRBREAK_ADMIN_TOKEN || ''
  if (!expected) return false
  const supplied = req.headers?.['x-admin-token'] || req.query?.token || ''
  if (typeof supplied !== 'string') return false
  const a = Buffer.from(supplied)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function rejectNonAdmin(req, res) {
  if (isAdminRequest(req)) return false
  res.status(403).json({
    error: 'Operator tool: set AIRBREAK_ADMIN_TOKEN and send it as the x-admin-token header.',
  })
  return true
}
