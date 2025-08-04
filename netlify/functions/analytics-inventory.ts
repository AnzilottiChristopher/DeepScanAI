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
    const { data: inventory, error } = await supabase
      .from('inventory')
      .select('drug_name, quantity, unit_cost, expiry_date')
      .order('quantity', { ascending: true })

    if (error) throw error

    const lowStockThreshold = 20
    const overStockThreshold = 500
    
    const lowStock = inventory.filter(item => item.quantity < lowStockThreshold)
    const overStock = inventory.filter(item => item.quantity > overStockThreshold)
    const normalStock = inventory.filter(item => 
      item.quantity >= lowStockThreshold && item.quantity <= overStockThreshold
    )
    
    const recommendations = lowStock.map(item => ({
      drug: item.drug_name,
      current: item.quantity,
      recommended: Math.max(item.quantity * 2, 50),
      reason: `Low stock alert - current quantity (${item.quantity}) below threshold (${lowStockThreshold})`,
      priority: item.quantity < 10 ? 'high' : 'medium'
    }))

    const result = {
      summary: {
        total_items: inventory.length,
        low_stock: lowStock.length,
        over_stock: overStock.length,
        normal_stock: normalStock.length
      },
      recommendations,
      efficiency_score: Math.round((normalStock.length / inventory.length) * 100)
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    }
  } catch (error) {
    console.error('Analytics error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Analytics failed' }),
    }
  }
}