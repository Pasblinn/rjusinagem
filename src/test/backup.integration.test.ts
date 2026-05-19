// Integration smoke tests against the live Supabase project.
// Only runs when SUPABASE_INTEGRATION=1, so it doesn't slow down or fail
// the normal `npm test` run when run offline / in CI without credentials.
//
// To run:
//   SUPABASE_INTEGRATION=1 SUPABASE_URL=... SUPABASE_ANON_KEY=... \
//     SUPABASE_BACKUP_SECRET=... npx vitest run src/test/backup.integration.test.ts

import { describe, it, expect } from 'vitest'

const enabled = process.env.SUPABASE_INTEGRATION === '1'
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const BACKUP_SECRET = process.env.SUPABASE_BACKUP_SECRET

describe.skipIf(!enabled || !SUPABASE_URL || !SUPABASE_ANON_KEY)(
  'backup-semanal Edge Function (integration)',
  () => {
    it('returns 401 when called without secret', async () => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/backup-semanal`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      })
      expect(res.status).toBe(401)
    })

    it.skipIf(!BACKUP_SECRET)(
      'returns 200 with file metadata when secret is valid',
      async () => {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/backup-semanal`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'x-backup-secret': BACKUP_SECRET!,
          },
          body: '{}',
        })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.ok).toBe(true)
        expect(body.file).toMatch(/^backup_\d{4}-\d{2}-\d{2}_\d{4}Z\.json$/)
        expect(body.total_rows).toBeGreaterThan(0)
        expect(Object.keys(body.tables)).toHaveLength(16)
      },
      30000,
    )
  },
)
