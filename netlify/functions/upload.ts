import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Simple multipart form parser
function parseMultipartForm(body: string, boundary: string) {
  const parts = body.split(`--${boundary}`)
  const formData: { [key: string]: string } = {}
  
  for (const part of parts) {
    if (part.includes('Content-Disposition: form-data')) {
      const nameMatch = part.match(/name="([^"]+)"/)
      if (nameMatch) {
        const fieldName = nameMatch[1]
        
        // Find the content after the headers
        const contentStart = part.indexOf('\r\n\r\n')
        if (contentStart !== -1) {
          let content = part.substring(contentStart + 4)
          // Remove trailing boundary markers and whitespace
          content = content.replace(/\r\n--.*$/, '').trim()
          formData[fieldName] = content
        }
      }
    }
  }
  
  return formData
}

// Parse CSV content into rows
function parseCSV(csvContent: string) {
  const lines = csvContent.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const row: { [key: string]: string } = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    return row
  })
  
  return { headers, rows }
}

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
    console.log('Upload request received')
    console.log('Content-Type:', event.headers['content-type'])
    console.log('Body length:', event.body?.length || 0)
    console.log('Is base64:', event.isBase64Encoded)

    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No request body provided' }),
      }
    }

    // Get boundary from content-type header
    const contentType = event.headers['content-type'] || ''
    const boundaryMatch = contentType.match(/boundary=(.+)$/)
    
    if (!boundaryMatch) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No boundary found in content-type header' }),
      }
    }

    const boundary = boundaryMatch[1]
    console.log('Boundary:', boundary)

    // Decode body if base64 encoded
    const body = event.isBase64Encoded ? 
      Buffer.from(event.body, 'base64').toString('utf-8') : 
      event.body

    console.log('Decoded body length:', body.length)

    // Parse multipart form data
    const formData = parseMultipartForm(body, boundary)
    console.log('Form fields found:', Object.keys(formData))

    const dataType = formData.dataType
    const csvContent = formData.csvFile

    if (!dataType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Data type is required' }),
      }
    }

    if (!csvContent) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'CSV file is required' }),
      }
    }

    console.log('Data type:', dataType)
    console.log('CSV content length:', csvContent.length)
    console.log('CSV preview:', csvContent.substring(0, 200))

    // Parse CSV
    const { headers: csvHeaders, rows } = parseCSV(csvContent)
    console.log('CSV headers:', csvHeaders)
    console.log('CSV rows count:', rows.length)

    if (rows.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No data rows found in CSV' }),
      }
    }

    let recordsProcessed = 0

    if (dataType === 'patients') {
      console.log('Processing patient data...')
      
      const patients = rows.map(row => ({
        patient_id: row.patient_id || row.PatientID || row.id,
        age: row.age ? parseInt(row.age) : null,
        gender: row.gender || row.Gender || null,
        diagnosis: row.diagnosis || row.Diagnosis || null,
        medications: row.medications || row.Medications || null,
        admission_date: row.admission_date || row.AdmissionDate || row.admission || null,
        discharge_date: row.discharge_date || row.DischargeDate || row.discharge || null,
      })).filter(p => p.patient_id && p.patient_id.trim() !== '')

      console.log('Valid patients:', patients.length)

      if (patients.length > 0) {
        const { data, error } = await supabase
          .from('patients')
          .upsert(patients, { onConflict: 'patient_id' })

        if (error) {
          console.error('Supabase error (patients):', error)
          throw error
        }

        recordsProcessed = patients.length
        console.log('Successfully processed patients:', recordsProcessed)
      }

    } else if (dataType === 'inventory') {
      console.log('Processing inventory data...')
      
      const inventory = rows.map(row => {
        const item = {
          drug_name: row.drug_name || row.DrugName || row.name || '',
          quantity: parseInt(row.quantity || row.Quantity || row.stock || '0') || 0,
          unit_cost: parseFloat(row.unit_cost || row.UnitCost || row.cost || '0') || 0,
          expiry_date: row.expiry_date || row.ExpiryDate || row.expiry || null,
          supplier: row.supplier || row.Supplier || null,
          category: row.category || row.Category || 'General',
        }
        console.log('Processed inventory item:', item)
        return item
      }).filter(i => i.drug_name && i.drug_name.trim() !== '')

      console.log('Valid inventory items:', inventory.length)

      if (inventory.length > 0) {
        // Insert items one by one to get better error handling
        let successCount = 0
        const errors: string[] = []

        for (const item of inventory) {
          try {
            console.log('Inserting:', item.drug_name)
            const { error } = await supabase
              .from('inventory')
              .upsert(item, { onConflict: 'drug_name' })

            if (error) {
              console.error(`Error inserting ${item.drug_name}:`, error)
              errors.push(`${item.drug_name}: ${error.message}`)
            } else {
              console.log(`Successfully inserted: ${item.drug_name}`)
              successCount++
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error'
            console.error(`Exception inserting ${item.drug_name}:`, errorMsg)
            errors.push(`${item.drug_name}: ${errorMsg}`)
          }
        }

        console.log('Final inventory results:', { successCount, errorCount: errors.length })

        if (errors.length > 0) {
          console.log('Inventory errors:', errors)
        }

        recordsProcessed = successCount

        if (successCount === 0 && errors.length > 0) {
          throw new Error(`No records processed. First error: ${errors[0]}`)
        }
      }

    } else {
      throw new Error(`Unknown data type: ${dataType}`)
    }

    const response = {
      message: `Successfully processed ${recordsProcessed} ${dataType} records`,
      recordsProcessed,
      dataType,
    }

    console.log('Upload successful:', response)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Upload function error:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    })

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Upload failed',
        details: errorMessage,
      }),
    }
  }
}