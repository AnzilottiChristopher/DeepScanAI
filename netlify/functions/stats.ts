import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export const handler: Handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  try {
    // Get patient count
    const { count: patientCount, error: patientError } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })

    if (patientError) throw patientError

    // Get inventory count
    const { count: inventoryCount, error: inventoryError } = await supabase
      .from('inventory')
      .select('*', { count: 'exact', head: true })

    if (inventoryError) throw inventoryError

    const stats = {
      patients: patientCount || 0,
      inventory: inventoryCount || 0,
      predictions: Math.floor(Math.random() * 50) + 10,
      alerts: Math.floor(Math.random() * 5) + 1,
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(stats),
    }
  } catch (error) {
    console.error('Error fetching stats:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch stats' }),
    }
  }
}