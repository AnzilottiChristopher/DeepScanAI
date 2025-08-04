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
      .select('drug_name, quantity, unit_cost, expiry_date, supplier, category')
      .order('quantity', { ascending: false })

    if (error) throw error

    // Calculate total inventory value and analyze costs
    const inventoryWithValue = inventory.map(item => ({
      ...item,
      total_value: item.quantity * item.unit_cost
    }))

    const totalInventoryValue = inventoryWithValue.reduce((sum, item) => sum + item.total_value, 0)
    const highValueItems = inventoryWithValue.filter(item => item.total_value > 1000)
    
    // Identify cost-saving opportunities
    const costSavingOpportunities: any[] = []
    
    // Group by category for bulk purchase opportunities
    const categoryGroups: { [key: string]: any[] } = {}
    inventoryWithValue.forEach(item => {
      if (!categoryGroups[item.category || 'General']) {
        categoryGroups[item.category || 'General'] = []
      }
      categoryGroups[item.category || 'General'].push(item)
    })
    
    Object.entries(categoryGroups).forEach(([category, items]) => {
      const totalCategoryValue = items.reduce((sum, item) => sum + item.total_value, 0)
      
      if (items.length > 3 && totalCategoryValue > 5000) {
        costSavingOpportunities.push({
          type: 'bulk_purchase',
          category: category,
          items_count: items.length,
          total_value: totalCategoryValue,
          potential_savings: totalCategoryValue * 0.15, // 15% bulk discount
          description: `Bulk purchase opportunity for ${category} category`
        })
      }
    })
    
    // Find overstocked expensive items
    const expensiveOverstock = inventoryWithValue.filter(item => 
      item.quantity > 100 && item.unit_cost > 50
    )
    
    expensiveOverstock.forEach(item => {
      const excessQuantity = Math.max(0, item.quantity - 50)
      const potentialSavings = excessQuantity * item.unit_cost * 0.8 // 80% recovery value
      
      if (potentialSavings > 500) {
        costSavingOpportunities.push({
          type: 'reduce_overstock',
          drug_name: item.drug_name,
          excess_quantity: excessQuantity,
          potential_savings: potentialSavings,
          description: `Reduce overstock of ${item.drug_name}`
        })
      }
    })
    
    const totalPotentialSavings = costSavingOpportunities.reduce(
      (sum, opp) => sum + opp.potential_savings, 0
    )
    
    const result = {
      total_inventory_value: totalInventoryValue,
      high_value_items: highValueItems.slice(0, 10),
      cost_saving_opportunities: costSavingOpportunities,
      potential_total_savings: totalPotentialSavings,
      summary: {
        total_items: inventory.length,
        high_value_items_count: highValueItems.length,
        savings_opportunities: costSavingOpportunities.length
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    }
  } catch (error) {
    console.error('Cost optimization error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Cost optimization failed' }),
    }
  }
}