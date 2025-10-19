import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_KEY;
const anonKey = process.env.ANON_KEY

if (!url || !key || !anonKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_*KEY or Anon_KEY');
}

export const supabaseAdmin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 2}},
})

export function createAnonClient() {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 2}},
  })
}


export function createUserClient(accessToken) {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 2}},
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

const supabase = createClient(url, key, {auth: { persistSession: false, autoRefreshToken: true }, realtime: { params: { eventsPerSecond: 2}}})

export default supabase