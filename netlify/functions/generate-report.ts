import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const openaiApiKey = process.env.OPENAI_API_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null

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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  try {
    // Get comprehensive data for report
    const { data: patients } = await supabase.from('patients').select('*')
    const { data: inventory } = await supabase.from('inventory').select('*')

    if (!openai) {
      // Generate basic report without AI
      const report = `# DeepScanRx Healthcare Analytics Report
Generated: ${new Date().toLocaleString()}

## Executive Summary
- Total Patients: ${patients?.length || 0}
- Total Inventory Items: ${inventory?.length || 0}
- System Status: Operational

## Key Findings
1. **Inventory Management**: Current stock levels require attention for optimal efficiency
2. **Patient Care**: Medication patterns show standard healthcare delivery
3. **Cost Optimization**: Opportunities exist for bulk purchasing and stock optimization

## Recommendations
1. Implement automated reorder points for critical medications
2. Review high-value inventory items for cost reduction opportunities
3. Establish supplier relationships for bulk purchasing discounts
4. Monitor patient medication trends for demand forecasting

*Note: Enhanced AI analysis requires OpenAI API configuration*`

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          report,
          generatedAt: new Date().toISOString()
        }),
      }
    }

    // Generate AI-powered comprehensive report
    const systemPrompt = `Generate a comprehensive healthcare analytics report based on the following data:

Patients: ${patients?.length || 0} records
Inventory: ${inventory?.length || 0} items

Include:
1. Executive Summary
2. Inventory Analysis & Optimization
3. Patient Medication Trends
4. Cost Analysis & Savings Opportunities
5. Demand Forecasting
6. Risk Assessment
7. Actionable Recommendations

Format as markdown with clear sections and bullet points.`

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate a comprehensive healthcare analytics report" }
      ],
      temperature: 0.3,
      max_tokens: 2000
    })

    const report = completion.choices[0].message.content?.trim() || "Report generation failed"

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        report,
        generatedAt: new Date().toISOString()
      }),
    }
  } catch (error) {
    console.error('Report generation error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to generate report',
        details: error.message
      }),
    }
  }
}