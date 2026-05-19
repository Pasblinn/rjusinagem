import { describe, it, expect } from 'vitest'
import { supabase } from './supabase'

describe('supabase client', () => {
  it('exposes auth and from APIs from @supabase/supabase-js', () => {
    expect(supabase).toBeDefined()
    expect(typeof supabase.auth).toBe('object')
    expect(typeof supabase.from).toBe('function')
    expect(typeof supabase.rpc).toBe('function')
    expect(typeof supabase.storage).toBe('object')
  })

  it('queries return a thenable builder (sanity)', () => {
    const builder = supabase.from('ordens_producao').select('id')
    expect(builder).toBeDefined()
    expect(typeof (builder as any).then).toBe('function')
  })
})
