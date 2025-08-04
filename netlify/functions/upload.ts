import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import multiparty from 'multiparty'
import csv from 'csv-parser'
import { Readable } from 'stream'

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
    // Parse multipart form data
    const form = new multiparty.Form()
    
    return new Promise((resolve) => {
      form.parse(event.body, async (err, fields, files) => {
        if (err) {
          resolve({
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Failed to parse form data' }),
          })
          return
        }

        const dataType = fields.dataType?.[0]
        const csvFile = files.csvFile?.[0]

        if (!dataType || !csvFile) {
          resolve({
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing data type or file' }),
          })
          return
        }

        try {
          // Read and parse CSV
          const csvData = csvFile.buffer || csvFile.path
          const results: any[] = []
          
          const stream = Readable.from(csvData.toString())
          
          stream
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
              try {
                let recordsProcessed = 0

                if (dataType === 'patients') {
                  const patients = results.map(row => ({
                    patient_id: row.patient_id || row.PatientID || row.id,
                    age: parseInt(row.age) || null,
                    gender: row.gender || row.Gender,
                    diagnosis: row.diagnosis || row.Diagnosis,
                    medications: row.medications || row.Medications,
                    admission_date: row.admission_date || row.AdmissionDate || row.admission,
                    discharge_date: row.discharge_date || row.DischargeDate || row.discharge,
                  }))

                  const { error } = await supabase
                    .from('patients')
                    .upsert(patients)

                  if (error) throw error
                  recordsProcessed = patients.length

                } else if (dataType === 'inventory') {
                  const inventory = results.map(row => ({
                    drug_name: row.drug_name || row.DrugName || row.name,
                    quantity: parseInt(row.quantity || row.Quantity || row.stock) || 0,
                    unit_cost: parseFloat(row.unit_cost || row.UnitCost || row.cost) || 0,
                    expiry_date: row.expiry_date || row.ExpiryDate || row.expiry,
                    supplier: row.supplier || row.Supplier,
                    category: row.category || row.Category || 'General',
                  }))

                  const { error } = await supabase
                    .from('inventory')
                    .upsert(inventory)

                  if (error) throw error
                  recordsProcessed = inventory.length
                }

                resolve({
                  statusCode: 200,
                  headers,
                  body: JSON.stringify({
                    message: `Successfully processed ${recordsProcessed} ${dataType} records`,
                    recordsProcessed,
                    dataType,
                  }),
                })
              } catch (error) {
                console.error('Database error:', error)
                resolve({
                  statusCode: 500,
                  headers,
                  body: JSON.stringify({ error: 'Database operation failed' }),
                })
              }
            })
        } catch (error) {
          console.error('CSV parsing error:', error)
          resolve({
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to process CSV file' }),
          })
        }
      })
    })
  } catch (error) {
    console.error('Upload error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Upload failed' }),
    }
  }
}