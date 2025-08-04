import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Patient {
  id?: number
  patient_id: string
  age?: number
  gender?: string
  diagnosis?: string
  medications?: string
  admission_date?: string
  discharge_date?: string
  created_at?: string
}

export interface InventoryItem {
  id?: number
  drug_name: string
  quantity: number
  unit_cost: number
  expiry_date?: string
  supplier?: string
  category?: string
  created_at?: string
}

export interface AnalyticsResult {
  id?: number
  analysis_type: string
  results: string
  created_at?: string
}