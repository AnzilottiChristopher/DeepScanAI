// Local API functions that work without Supabase
import { mockPatients, mockInventory, mockStats } from './mockData';

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const localApi = {
  // Get stats
  async getStats() {
    await delay(500);
    return mockStats;
  },

  // Upload CSV (mock)
  async uploadCsv(formData: FormData) {
    await delay(1000);
    const dataType = formData.get('dataType') as string;
    const file = formData.get('csvFile') as File;
    
    if (!dataType || !file) {
      throw new Error('Missing data type or file');
    }

    // Simulate processing
    const recordsProcessed = Math.floor(Math.random() * 20) + 5;
    
    return {
      message: `Successfully processed ${recordsProcessed} ${dataType} records`,
      recordsProcessed,
      dataType
    };
  },

  // Inventory analytics
  async getInventoryAnalytics() {
    await delay(800);
    
    const lowStockThreshold = 20;
    const overStockThreshold = 200;
    
    const lowStock = mockInventory.filter(item => item.quantity < lowStockThreshold);
    const overStock = mockInventory.filter(item => item.quantity > overStockThreshold);
    const normalStock = mockInventory.filter(item => 
      item.quantity >= lowStockThreshold && item.quantity <= overStockThreshold
    );
    
    const recommendations = lowStock.map(item => ({
      drug: item.drug_name,
      current: item.quantity,
      recommended: Math.max(item.quantity * 2, 50),
      reason: `Low stock alert - current quantity (${item.quantity}) below threshold (${lowStockThreshold})`,
      priority: item.quantity < 10 ? 'high' : 'medium'
    }));

    return {
      summary: {
        total_items: mockInventory.length,
        low_stock: lowStock.length,
        over_stock: overStock.length,
        normal_stock: normalStock.length
      },
      recommendations,
      efficiency_score: Math.round((normalStock.length / mockInventory.length) * 100)
    };
  },

  // Demand prediction
  async getDemandPrediction() {
    await delay(1200);
    
    // Process medication usage from mock patient data
    const medicationUsage: { [key: string]: number } = {};
    
    mockPatients.forEach(patient => {
      if (patient.medications) {
        const medications = patient.medications.split(',').map(m => m.trim());
        medications.forEach(med => {
          medicationUsage[med] = (medicationUsage[med] || 0) + 1;
        });
      }
    });

    // Create inventory map
    const inventoryMap: { [key: string]: number } = {};
    mockInventory.forEach(item => {
      inventoryMap[item.drug_name.toLowerCase()] = item.quantity;
    });

    // Generate predictions
    const predictions = Object.entries(medicationUsage)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 6)
      .map(([medication, usage]) => {
        const currentStock = inventoryMap[medication.toLowerCase()] || 0;
        const seasonalFactor = 1 + (Math.sin(Date.now() / (1000 * 60 * 60 * 24 * 30)) * 0.2);
        const predictedDemand = Math.round(usage * seasonalFactor * 1.1);
        
        return {
          medication,
          historical_usage: usage,
          predicted_demand: predictedDemand,
          current_stock: currentStock,
          trend: predictedDemand > usage ? 'increasing' : 'stable',
          stock_adequacy: currentStock > predictedDemand * 2 ? 'overstocked' : 
                         currentStock > predictedDemand ? 'adequate' : 'understocked'
        };
      });

    return {
      predictions,
      summary: {
        total_medications_analyzed: predictions.length,
        understocked_items: predictions.filter(p => p.stock_adequacy === 'understocked').length,
        overstocked_items: predictions.filter(p => p.stock_adequacy === 'overstocked').length
      }
    };
  },

  // Cost optimization
  async getCostOptimization() {
    await delay(900);
    
    const inventoryWithValue = mockInventory.map(item => ({
      ...item,
      total_value: item.quantity * item.unit_cost
    }));

    const totalInventoryValue = inventoryWithValue.reduce((sum, item) => sum + item.total_value, 0);
    const highValueItems = inventoryWithValue.filter(item => item.total_value > 500);
    
    // Mock cost-saving opportunities
    const costSavingOpportunities = [
      {
        type: 'bulk_purchase',
        category: 'Cardiovascular',
        items_count: 3,
        total_value: 2500,
        potential_savings: 375,
        description: 'Bulk purchase opportunity for Cardiovascular category'
      },
      {
        type: 'reduce_overstock',
        drug_name: 'Metformin',
        excess_quantity: 150,
        potential_savings: 1312.50,
        description: 'Reduce overstock of Metformin'
      }
    ];
    
    const totalPotentialSavings = costSavingOpportunities.reduce(
      (sum, opp) => sum + opp.potential_savings, 0
    );
    
    return {
      total_inventory_value: totalInventoryValue,
      high_value_items: highValueItems.slice(0, 5),
      cost_saving_opportunities: costSavingOpportunities,
      potential_total_savings: totalPotentialSavings,
      summary: {
        total_items: mockInventory.length,
        high_value_items_count: highValueItems.length,
        savings_opportunities: costSavingOpportunities.length
      }
    };
  },

  // AI Chat (mock responses)
  async sendChatMessage(message: string) {
    await delay(1500);
    
    let response = "I'm analyzing your request using the mock data...";
    
    if (message.toLowerCase().includes('inventory')) {
      response = "Based on your current inventory data, I can see you have 8 different medications. Lisinopril and Insulin are running low with quantities of 15 and 5 respectively. I recommend reordering these items soon.";
    } else if (message.toLowerCase().includes('patient')) {
      response = "Your patient data shows 5 patients with various conditions. The most common medications are cardiovascular drugs (Lisinopril, Atorvastatin) and diabetes medications (Metformin, Insulin). Would you like a detailed breakdown?";
    } else if (message.toLowerCase().includes('cost')) {
      response = "Cost analysis shows your total inventory value is approximately $3,247. I've identified potential savings of $1,687 through bulk purchasing and reducing overstock of Metformin.";
    } else if (message.toLowerCase().includes('predict')) {
      response = "Demand prediction indicates Metformin and Lisinopril are your most frequently prescribed medications. Based on patient patterns, you should maintain higher stock levels for these drugs.";
    }

    return {
      response: {
        text: response,
        action: 'analysis_complete',
        suggestions: [
          "Show me low stock items",
          "Predict demand for cardiovascular drugs",
          "Find bulk purchase opportunities",
          "Analyze patient medication patterns",
          "Generate cost optimization report"
        ]
      },
      timestamp: new Date().toISOString()
    };
  },

  // Generate report
  async generateReport() {
    await delay(2000);
    
    const report = `# DeepScanRx Healthcare Analytics Report
*Generated: ${new Date().toLocaleString()} (Local Mock Data)*

## Executive Summary
- **Total Patients**: 5 records
- **Total Inventory Items**: 8 medications
- **System Status**: Running in local development mode

## Key Findings

### 1. Inventory Analysis
- **Critical Low Stock**: Insulin (5 units), Hydrochlorothiazide (8 units)
- **Adequate Stock**: Metformin (250 units), Atorvastatin (120 units)
- **Efficiency Score**: 75%

### 2. Patient Medication Trends
- **Most Prescribed**: Cardiovascular medications (40%)
- **Second Most**: Diabetes medications (25%)
- **Average Patient Age**: 45.8 years

### 3. Cost Optimization Opportunities
- **Total Inventory Value**: $3,247
- **Potential Savings**: $1,687 (52% of total value)
- **Primary Opportunity**: Bulk purchasing for cardiovascular category

### 4. Demand Predictions
- **High Demand**: Metformin, Lisinopril, Atorvastatin
- **Seasonal Factors**: Respiratory medications may increase in winter
- **Reorder Recommendations**: 6 items need attention

## Recommendations

1. **Immediate Actions**:
   - Reorder Insulin (critical low stock)
   - Reorder Hydrochlorothiazide (below safety threshold)
   - Review Metformin stock levels (potential overstock)

2. **Cost Savings**:
   - Negotiate bulk pricing for cardiovascular medications
   - Consider generic alternatives where appropriate
   - Implement automated reorder points

3. **Process Improvements**:
   - Set up automated low-stock alerts
   - Establish supplier relationships for emergency orders
   - Implement demand forecasting based on patient admissions

## Next Steps
1. Connect to live Supabase database for real-time data
2. Configure OpenAI API for enhanced AI analysis
3. Set up automated reporting schedules
4. Implement predictive analytics dashboard

---
*Note: This report is generated using mock data for demonstration purposes. Connect to Supabase for live data analysis.*`;

    return {
      report,
      generatedAt: new Date().toISOString()
    };
  }
};