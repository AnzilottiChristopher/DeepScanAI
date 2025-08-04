const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const helmet = require('helmet');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const DeepScanRxAgent = require('./ai-agent.cjs');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = 3001;

// Initialize AI Agent
const aiAgent = new DeepScanRxAgent();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Initialize SQLite database
const db = new sqlite3.Database('./deepscanrx.db');

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id TEXT,
    age INTEGER,
    gender TEXT,
    diagnosis TEXT,
    medications TEXT,
    admission_date TEXT,
    discharge_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drug_name TEXT,
    quantity INTEGER,
    unit_cost REAL,
    expiry_date TEXT,
    supplier TEXT,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_type TEXT,
    results TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// API Routes
app.get('/api/stats', (req, res) => {
  try {
    const stats = {};
    
    db.get('SELECT COUNT(*) as count FROM patients', (err, patientRow) => {
      if (err) {
        console.error('Database error (patients):', err);
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
      
      stats.patients = patientRow ? patientRow.count : 0;
      
      db.get('SELECT COUNT(*) as count FROM inventory', (err, inventoryRow) => {
        if (err) {
          console.error('Database error (inventory):', err);
          return res.status(500).json({ error: 'Database error', details: err.message });
        }
        
        stats.inventory = inventoryRow ? inventoryRow.count : 0;
        stats.predictions = Math.floor(Math.random() * 50) + 10; // Mock data
        stats.alerts = Math.floor(Math.random() * 5) + 1; // Mock data
        
        console.log('Sending stats:', stats);
        res.json(stats);
      });
    });
  } catch (error) {
    console.error('Unexpected error in /api/stats:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  const dataType = req.body.dataType;
  
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  if (!dataType) {
    return res.status(400).json({ error: 'Data type not specified' });
  }

  const filePath = file.path;
  const results = [];
  let recordsProcessed = 0;

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      try {
        if (dataType === 'patients') {
          const stmt = db.prepare(`INSERT OR REPLACE INTO patients (patient_id, age, gender, diagnosis, medications, admission_date, discharge_date) VALUES (?, ?, ?, ?, ?, ?, ?)`);
          
          results.forEach(row => {
            stmt.run(
              row.patient_id || row.PatientID || row.id,
              parseInt(row.age) || null,
              row.gender || row.Gender,
              row.diagnosis || row.Diagnosis,
              row.medications || row.Medications,
              row.admission_date || row.AdmissionDate || row.admission,
              row.discharge_date || row.DischargeDate || row.discharge
            );
            recordsProcessed++;
          });
          stmt.finalize();
          
        } else if (dataType === 'inventory') {
          const stmt = db.prepare(`INSERT OR REPLACE INTO inventory (drug_name, quantity, unit_cost, expiry_date, supplier, category) VALUES (?, ?, ?, ?, ?, ?)`);
          
          results.forEach(row => {
            stmt.run(
              row.drug_name || row.DrugName || row.name,
              parseInt(row.quantity || row.Quantity || row.stock) || 0,
              parseFloat(row.unit_cost || row.UnitCost || row.cost) || 0,
              row.expiry_date || row.ExpiryDate || row.expiry,
              row.supplier || row.Supplier,
              row.category || row.Category || 'General'
            );
            recordsProcessed++;
          });
          stmt.finalize();
        }
        
        // Clean up uploaded file
        fs.unlinkSync(filePath);
        
        res.json({ 
          message: `Successfully processed ${recordsProcessed} ${dataType} records`,
          recordsProcessed: recordsProcessed,
          dataType: dataType
        });
        
      } catch (error) {
        console.error('Error processing CSV:', error);
        fs.unlinkSync(filePath);
        res.status(500).json({ error: 'Error processing CSV data', details: error.message });
      }
    });
});

app.get('/api/analytics/inventory-optimization', (req, res) => {
  db.all(`SELECT drug_name, quantity, unit_cost, expiry_date FROM inventory ORDER BY quantity ASC`, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }

    const lowStockThreshold = 20;
    const overStockThreshold = 500;
    
    const lowStock = rows.filter(item => item.quantity < lowStockThreshold);
    const overStock = rows.filter(item => item.quantity > overStockThreshold);
    const normalStock = rows.filter(item => item.quantity >= lowStockThreshold && item.quantity <= overStockThreshold);
    
    const recommendations = lowStock.map(item => ({
      drug: item.drug_name,
      current: item.quantity,
      recommended: Math.max(item.quantity * 2, 50),
      reason: `Low stock alert - current quantity (${item.quantity}) below threshold (${lowStockThreshold})`,
      priority: item.quantity < 10 ? 'high' : 'medium'
    }));

    res.json({
      summary: {
        total_items: rows.length,
        low_stock: lowStock.length,
        over_stock: overStock.length,
        normal_stock: normalStock.length
      },
      recommendations,
      efficiency_score: Math.round((normalStock.length / rows.length) * 100)
    });
  });
});

app.get('/api/analytics/demand-prediction', (req, res) => {
  // Get medication usage from patient data
  db.all(`
    SELECT 
      medications,
      COUNT(*) as patient_count,
      AVG(CASE WHEN discharge_date IS NOT NULL THEN 
        (julianday(discharge_date) - julianday(admission_date)) 
        ELSE 7 END) as avg_stay_days
    FROM patients 
    WHERE medications IS NOT NULL AND medications != ''
    GROUP BY medications 
    ORDER BY patient_count DESC
  `, (err, patientRows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }

    // Get current inventory levels
    db.all(`SELECT drug_name, quantity FROM inventory`, (err, inventoryRows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
      
      const inventoryMap = {};
      inventoryRows.forEach(item => {
        inventoryMap[item.drug_name.toLowerCase()] = item.quantity;
      });
      
      const predictions = patientRows.slice(0, 10).map(item => {
        const medication = item.medications;
        const historicalUsage = item.patient_count;
        const avgStay = Math.round(item.avg_stay_days);
        const currentStock = inventoryMap[medication.toLowerCase()] || 0;
        
        // Simple prediction based on historical usage and seasonal factors
        const seasonalFactor = 1 + (Math.sin(Date.now() / (1000 * 60 * 60 * 24 * 30)) * 0.2);
        const predictedDemand = Math.round(historicalUsage * seasonalFactor * 1.1);
        
        return {
          medication: medication,
          historical_usage: historicalUsage,
          predicted_demand: predictedDemand,
          current_stock: currentStock,
          avg_treatment_days: avgStay,
          trend: predictedDemand > historicalUsage ? 'increasing' : 'stable',
          stock_adequacy: currentStock > predictedDemand * 2 ? 'overstocked' : 
                         currentStock > predictedDemand ? 'adequate' : 'understocked'
        };
      });

      res.json({
        predictions,
        summary: {
          total_medications_analyzed: predictions.length,
          understocked_items: predictions.filter(p => p.stock_adequacy === 'understocked').length,
          overstocked_items: predictions.filter(p => p.stock_adequacy === 'overstocked').length
        }
      });
    });
  });
});

app.get('/api/analytics/cost-optimization', (req, res) => {
  db.all(`
    SELECT 
      drug_name,
      quantity,
      unit_cost,
      (quantity * unit_cost) as total_value,
      expiry_date,
      supplier,
      category
    FROM inventory 
    ORDER BY total_value DESC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    
    const totalInventoryValue = rows.reduce((sum, item) => sum + item.total_value, 0);
    const highValueItems = rows.filter(item => item.total_value > 1000);
    
    // Identify cost-saving opportunities
    const costSavingOpportunities = [];
    
    // Group by category to find bulk purchase opportunities
    const categoryGroups = {};
    rows.forEach(item => {
      if (!categoryGroups[item.category]) {
        categoryGroups[item.category] = [];
      }
      categoryGroups[item.category].push(item);
    });
    
    Object.keys(categoryGroups).forEach(category => {
      const items = categoryGroups[category];
      const totalCategoryValue = items.reduce((sum, item) => sum + item.total_value, 0);
      
      if (items.length > 3 && totalCategoryValue > 5000) {
        costSavingOpportunities.push({
          type: 'bulk_purchase',
          category: category,
          items_count: items.length,
          total_value: totalCategoryValue,
          potential_savings: totalCategoryValue * 0.15, // 15% bulk discount
          description: `Bulk purchase opportunity for ${category} category`
        });
      }
    });
    
    // Find overstocked expensive items
    const expensiveOverstock = rows.filter(item => 
      item.quantity > 100 && item.unit_cost > 50
    );
    
    expensiveOverstock.forEach(item => {
      const excessQuantity = Math.max(0, item.quantity - 50);
      const potentialSavings = excessQuantity * item.unit_cost * 0.8; // 80% recovery value
      
      if (potentialSavings > 500) {
        costSavingOpportunities.push({
          type: 'reduce_overstock',
          drug_name: item.drug_name,
          excess_quantity: excessQuantity,
          potential_savings: potentialSavings,
          description: `Reduce overstock of ${item.drug_name}`
        });
      }
    });
    
    const totalPotentialSavings = costSavingOpportunities.reduce(
      (sum, opp) => sum + opp.potential_savings, 0
    );
    
    res.json({
      total_inventory_value: totalInventoryValue,
      high_value_items: highValueItems.slice(0, 10),
      cost_saving_opportunities: costSavingOpportunities,
      potential_total_savings: totalPotentialSavings,
      summary: {
        total_items: rows.length,
        high_value_items_count: highValueItems.length,
        savings_opportunities: costSavingOpportunities.length
      }
    });
  });
});

app.post('/api/assistant/chat', (req, res) => {
  const { message, context } = req.body;
  
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  // Use AI agent to process the query
  const dbPath = path.resolve('./deepscanrx.db');
  
  aiAgent.processQuery(message, dbPath)
    .then(result => {
      res.json({
        response: {
          text: result.response,
          action: result.error ? null : 'analysis_complete',
          suggestions: [
            "Analyze low stock items",
            "Predict drug demand trends", 
            "Find cost-saving opportunities",
            "Generate comprehensive report",
            "Show patient medication patterns"
          ]
        },
        pythonCode: result.pythonCode,
        analysisResults: result.results,
        conversationId: result.conversationId,
        timestamp: new Date().toISOString()
      });
    })
    .catch(error => {
      console.error('AI Assistant Error:', error);
      res.json({
        response: {
          text: "I'm currently experiencing technical difficulties. Please try a simpler query or check back later.",
          action: null,
          suggestions: [
            "Show inventory summary",
            "List recent uploads",
            "Display basic statistics"
          ]
        },
        error: true,
        timestamp: new Date().toISOString()
      });
    });
});

// Get conversation history
app.get('/api/assistant/history', (req, res) => {
  res.json({
    history: aiAgent.getConversationHistory(),
    timestamp: new Date().toISOString()
  });
});

// Clear conversation history
app.post('/api/assistant/clear', (req, res) => {
  aiAgent.clearHistory();
  res.json({
    message: 'Conversation history cleared',
    timestamp: new Date().toISOString()
  });
});

// Generate comprehensive report
app.post('/api/generate-report', async (req, res) => {
  try {
    const dbPath = path.resolve('./deepscanrx.db');
    const reportQuery = `Generate a comprehensive healthcare analytics report covering:
    1. Inventory optimization recommendations
    2. Drug demand predictions for next 3 months
    3. Cost-saving opportunities
    4. Patient medication trend analysis
    5. Supply chain risk assessment
    Please include charts and detailed insights.`;
    
    const result = await aiAgent.processQuery(reportQuery, dbPath);
    
    res.json({
      report: result.response,
      pythonCode: result.pythonCode,
      analysisResults: result.results,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({
      error: 'Failed to generate report',
      details: error.message
    });
  }
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

app.listen(PORT, () => {
  console.log(`🚀 DeepScanRx server running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`🤖 AI Assistant ${process.env.OPENAI_API_KEY ? 'ENABLED' : 'DISABLED (no API key)'}`);
});