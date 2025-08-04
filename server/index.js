const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const helmet = require('helmet');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

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
  const stats = {};
  
  db.get('SELECT COUNT(*) as count FROM patients', (err, patientRow) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    stats.patients = patientRow.count;
    
    db.get('SELECT COUNT(*) as count FROM inventory', (err, inventoryRow) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      stats.inventory = inventoryRow.count;
      stats.predictions = Math.floor(Math.random() * 50) + 10; // Mock data
      stats.alerts = Math.floor(Math.random() * 5) + 1; // Mock data
      
      res.json(stats);
    });
  });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = req.file.path;
  const fileType = req.body.type; // 'patients' or 'inventory'
  const results = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      if (fileType === 'patients') {
        const stmt = db.prepare(`INSERT INTO patients (patient_id, age, gender, diagnosis, medications, admission_date, discharge_date) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        
        results.forEach(row => {
          stmt.run(row.patient_id, row.age, row.gender, row.diagnosis, row.medications, row.admission_date, row.discharge_date);
        });
        stmt.finalize();
      } else if (fileType === 'inventory') {
        const stmt = db.prepare(`INSERT INTO inventory (drug_name, quantity, unit_cost, expiry_date, supplier, category) VALUES (?, ?, ?, ?, ?, ?)`);
        
        results.forEach(row => {
          stmt.run(row.drug_name, row.quantity, row.unit_cost, row.expiry_date, row.supplier, row.category);
        });
        stmt.finalize();
      }

      // Clean up uploaded file
      fs.unlinkSync(filePath);
      
      res.json({ message: `Successfully uploaded ${results.length} records`, count: results.length });
    });
});

app.get('/api/analytics/inventory-optimization', (req, res) => {
  db.all(`SELECT drug_name, quantity, unit_cost, expiry_date FROM inventory ORDER BY quantity ASC LIMIT 10`, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    const recommendations = rows.map(item => ({
      drug: item.drug_name,
      currentStock: item.quantity,
      recommendedStock: Math.max(item.quantity * 1.5, 50),
      priority: item.quantity < 20 ? 'High' : item.quantity < 50 ? 'Medium' : 'Low',
      costImpact: (Math.max(item.quantity * 1.5, 50) - item.quantity) * item.unit_cost
    }));

    res.json({
      recommendations,
      totalCostImpact: recommendations.reduce((sum, item) => sum + item.costImpact, 0),
      highPriorityItems: recommendations.filter(item => item.priority === 'High').length
    });
  });
});

app.get('/api/analytics/demand-prediction', (req, res) => {
  db.all(`SELECT drug_name, COUNT(*) as usage_count FROM inventory GROUP BY drug_name ORDER BY usage_count DESC LIMIT 10`, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    const predictions = rows.map(item => ({
      drug: item.drug_name,
      currentUsage: item.usage_count,
      predictedDemand: Math.floor(item.usage_count * (1 + Math.random() * 0.3)),
      trend: Math.random() > 0.5 ? 'Increasing' : 'Stable',
      confidence: Math.floor(Math.random() * 20) + 80
    }));

    res.json({
      predictions,
      averageConfidence: predictions.reduce((sum, item) => sum + item.confidence, 0) / predictions.length
    });
  });
});

app.post('/api/assistant/chat', (req, res) => {
  const { message } = req.body;
  
  // Simple AI assistant simulation
  let response = "I'm analyzing your request...";
  
  if (message.toLowerCase().includes('inventory')) {
    response = "Based on your current inventory data, I recommend focusing on drugs with low stock levels. Would you like me to generate a detailed inventory optimization report?";
  } else if (message.toLowerCase().includes('patient')) {
    response = "I can help analyze patient data patterns. What specific insights are you looking for regarding patient medications or outcomes?";
  } else if (message.toLowerCase().includes('cost')) {
    response = "Cost analysis shows potential savings through better inventory management. I can generate a cost optimization script if needed.";
  } else if (message.toLowerCase().includes('predict')) {
    response = "Predictive analytics indicate seasonal variations in drug demand. I can create forecasting models based on your historical data.";
  }
  
  res.json({ response, timestamp: new Date().toISOString() });
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

app.listen(PORT, () => {
  console.log(`DeepScanRx server running on port ${PORT}`);
});