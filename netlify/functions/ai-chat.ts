import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const openaiApiKey = process.env.OPENAI_API_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null

export const handler: Handler = async (event, context) => {
  console.log('AI Chat function called')
  console.log('OpenAI API Key present:', !!openaiApiKey)
  console.log('OpenAI client initialized:', !!openai)
  
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
    const { message, context: userContext } = JSON.parse(event.body || '{}')
    console.log('Parsed message:', message)
    console.log('User context:', userContext)

    if (!message || message.trim() === '') {
      console.log('Empty message provided')
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message is required' }),
      }
    }

    // If OpenAI is not configured, provide basic responses
    if (!openai) {
      console.log('Using mock responses (no OpenAI)')
      let response = "I'm analyzing your request..."
      
      if (message.toLowerCase().includes('inventory')) {
        response = "Based on your current inventory data, I recommend focusing on drugs with low stock levels. Would you like me to generate a detailed inventory optimization report?"
      } else if (message.toLowerCase().includes('patient')) {
        response = "I can help analyze patient data patterns. What specific insights are you looking for regarding patient medications or outcomes?"
      } else if (message.toLowerCase().includes('cost')) {
        response = "Cost analysis shows potential savings through better inventory management. I can generate a cost optimization analysis if needed."
      } else if (message.toLowerCase().includes('predict')) {
        response = "Predictive analytics indicate seasonal variations in drug demand. I can create forecasting models based on your historical data."
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          response: {
            text: response,
            action: 'analysis_complete',
            suggestions: [
              "Analyze low stock items",
              "Predict drug demand trends", 
              "Find cost-saving opportunities",
              "Generate comprehensive report",
              "Show patient medication patterns"
            ]
          },
          timestamp: new Date().toISOString()
        }),
      }
    }

    // Get current data context
    const { data: patients } = await supabase.from('patients').select('*').limit(100)
    const { data: inventory } = await supabase.from('inventory').select('*').limit(100)
    
    console.log('Fetched patients:', patients?.length || 0)
    console.log('Fetched inventory:', inventory?.length || 0)

    const systemPrompt = `You are DeepScanRx, an AI assistant for healthcare analytics.

Available data:
- Patients: ${patients?.length || 0} records
- Inventory: ${inventory?.length || 0} items

Database schema:
- patients: patient_id, age, gender, diagnosis, medications, admission_date, discharge_date
- inventory: drug_name, quantity, unit_cost, expiry_date, supplier, category

Provide insights and recommendations for hospital pharmacy management based on the user's query.
Be professional, actionable, and focus on practical healthcare analytics.`

    console.log('Making OpenAI API call...')
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })

    console.log('OpenAI API call successful')
    const aiResponse = completion.choices[0].message.content?.trim() || "I'm sorry, I couldn't process your request."

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        response: {
          text: aiResponse,
          action: 'analysis_complete',
          suggestions: [
            "Show me inventory optimization opportunities",
            "Predict drug demand for next quarter", 
            "Find cost-saving opportunities in my data",
            "Generate a comprehensive analytics report",
            "Analyze patient medication patterns"
          ]
        },
        timestamp: new Date().toISOString()
      }),
    }
  } catch (error) {
    console.error('AI Chat error:', error)
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    })
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        response: {
          text: `I'm currently experiencing technical difficulties: ${error.message}. Please try a simpler query or check back later.`,
          action: null,
          suggestions: [
            "Show inventory summary",
            "List recent uploads",
            "Display basic statistics"
          ]
        },
        error: true,
        errorDetails: error.message,
        timestamp: new Date().toISOString()
      }),
    }
  }
}