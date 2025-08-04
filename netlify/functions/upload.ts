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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  try {
    // Parse the form data from the request body
    const boundary = event.headers['content-type']?.split('boundary=')[1]
    if (!boundary) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No boundary found in content-type' }),
      }
    }

    const body = event.isBase64Encoded ? 
      Buffer.from(event.body || '', 'base64').toString() : 
      event.body || ''

    // Simple multipart parser
    const parts = body.split(`--${boundary}`)
    let dataType = ''
    let csvContent = ''

    for (const part of parts) {
      if (part.includes('name="dataType"')) {
        const lines = part.split('\r\n')
        dataType = lines[lines.length - 2] || ''
      } else if (part.includes('name="csvFile"')) {
        const contentStart = part.indexOf('\r\n\r\n')
        if (contentStart !== -1) {
          csvContent = part.substring(contentStart + 4).replace(/\r\n$/, '')
        }
      }
    }

    console.log('Parsed form data:', { dataType, csvContentLength: csvContent.length })

    if (!dataType || !csvContent) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing data type or file content',
          debug: { dataType, hasContent: !!csvContent }
        }),
      }
    }

    // Parse CSV content
    const lines = csvContent.trim().split('\n')
    console.log('CSV lines count:', lines.length)
    
    const headers_csv = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    console.log('CSV headers:', headers_csv)
    
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
      const row: any = {}
      headers_csv.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      return row
    })

    console.log('Parsed rows count:', rows.length)
    console.log('First row sample:', rows[0])

    let recordsProcessed = 0

    if (dataType === 'patients') {
      const patients = rows.map(row => ({
        patient_id: row.patient_id || row.PatientID || row.id,
        age: parseInt(row.age) || null,
        gender: row.gender || row.Gender,
        diagnosis: row.diagnosis || row.Diagnosis,
        medications: row.medications || row.Medications,
        admission_date: row.admission_date || row.AdmissionDate || row.admission,
        discharge_date: row.discharge_date || row.DischargeDate || row.discharge,
      })).filter(p => p.patient_id) // Only include rows with patient_id

      if (patients.length > 0) {
        const { error } = await supabase
          .from('patients')
          .upsert(patients, { onConflict: 'patient_id' })

        if (error) throw error
        recordsProcessed = patients.length
      }

    } else if (dataType === 'inventory') {
      const inventory = rows.map(row => ({
        drug_name: row.drug_name || row.DrugName || row.name,
        quantity: parseInt(row.quantity || row.Quantity || row.stock || '0') || 0,
        unit_cost: parseFloat(row.unit_cost || row.UnitCost || row.cost || '0') || 0,
        expiry_date: row.expiry_date || row.ExpiryDate || row.expiry,
        supplier: row.supplier || row.Supplier,
        category: row.category || row.Category || 'General',
      })).filter(i => i.drug_name) // Only include rows with drug_name

      console.log('Processed inventory items:', inventory.length)
      console.log('First inventory item:', inventory[0])

      if (inventory.length > 0) {
        // Insert inventory items one by one to handle conflicts better
        let successCount = 0
        const errors = []
        
        for (const item of inventory) {
          try {
            console.log('Processing item:', item.drug_name)
            const { error } = await supabase
              .from('inventory')
              .upsert(item, { onConflict: 'drug_name' })
            
            if (error) {
              console.error('Supabase error for', item.drug_name, ':', error)
              errors.push(`${item.drug_name}: ${error.message}`)
            } else {
              console.log('Successfully processed:', item.drug_name)
              successCount++
            }
          } catch (err) {
            console.error('Exception for', item.drug_name, ':', err)
            errors.push(`${item.drug_name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
          }
        }
        
        console.log('Final results:', { successCount, errorCount: errors.length })
        
        if (errors.length > 0) {
          console.error('Inventory upload errors:', errors)
        }
        
        recordsProcessed = successCount
        
        // If no records were processed, throw an error with details
        if (successCount === 0) {
          const errorDetails = errors.slice(0, 5).join('; ')
          console.error('All inventory records failed:', errorDetails)
          throw new Error(`No inventory records processed. Errors: ${errorDetails}`)
        }
      } else {
        console.error('No valid inventory records found')
        throw new Error('No valid inventory records found in CSV. Check that drug_name column exists.')
      }
    } else {
      throw new Error(`Unknown data type: ${dataType}`)
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: `Successfully processed ${recordsProcessed} ${dataType} records`,
        recordsProcessed,
        dataType,
      }),
    }
  } catch (error) {
    console.error('Upload error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      dataType,
      csvContentLength: csvContent?.length || 0
    })
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        dataType
      }),
    }
  }
}