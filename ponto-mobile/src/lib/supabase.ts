import { createClient } from '@supabase/supabase-js'

// Valores fixos para produção
const SUPABASE_URL = 'https://kkevepwlvvhqweocywvq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrZXZlcHdsdnZocXdlb2N5d3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODg4NjksImV4cCI6MjA4NDA2NDg2OX0.Ow3FoWeecus_rNjpYDNDJHrpQH3bM1kBV33Flfcfkq8'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
