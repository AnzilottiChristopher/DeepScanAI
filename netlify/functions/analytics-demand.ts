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
    // Get medication usage from patient data
    const { data: patientData, error: patientError } = await supabase
      .from('patients')
      .select('medications, admission_date, discharge_date')
      .not('medications', 'is', null)
      .neq('medications', '')

    if (patientError) throw patientError

    // Get current inventory levels
    const { data: inventoryData, error: inventoryError } = await supabase
      .from('inventory')
      .select('drug_name, quantity')

    if (inventoryError) throw inventoryError

    // Process medication usage
    const medicationUsage: { [key: string]: number } = {}
    
    patientData.forEach(patient => {
      if (patient.medications) {
        const medications = patient.medications.split(',').map(m => m.trim())
        medications.forEach(med => {
          medicationUsage[med] = (medicationUsage[med] || 0) + 1
        })
      }
    })

    // Create inventory map
    const inventoryMap: { [key: string]: number } = {}
    inventoryData.forEach(item => {
      inventoryMap[item.drug_name.toLowerCase()] = item.quantity
    })

    // Generate predictions
    const predictions = Object.entries(medicationUsage)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([medication, usage]) => {
        const currentStock = inventoryMap[medication.toLowerCase()] || 0
        const seasonalFactor = 1 + (Math.sin(Date.now() / (1000 * 60 * 60 * 24 * 30)) * 0.2)
        const predictedDemand = Math.round(usage * seasonalFactor * 1.1)
        
        return {
          medication,
          historical_usage: usage,
          predicted_demand: predictedDemand,
          current_stock: currentStock,
          trend: predictedDemand > usage ? 'increasing' : 'stable',
          stock_adequacy: currentStock > predictedDemand * 2 ? 'overstocked' : 
                         currentStock > predictedDemand ? 'adequate' : 'understocked'
        }
      })

    const result = {
      predictions,
      summary: {
        total_medications_analyzed: predictions.length,
        understocked_items: predictions.filter(p => p.stock_adequacy === 'understocked').length,
        overstocked_items: predictions.filter(p => p.stock_adequacy === 'overstocked').length
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    }
  } catch (error) {
    console.error('Demand prediction error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Demand prediction failed' }),
    }
  }
}