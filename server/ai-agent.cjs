const OpenAI = require('openai');
const { PythonShell } = require('python-shell');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class DeepScanRxAgent {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key-here'
    });
    this.conversationHistory = [];
    this.context = {
      availableTables: ['patients', 'inventory'],
      lastQuery: null,
      dataSchema: {
        patients: ['patient_id', 'age', 'gender', 'diagnosis', 'medications', 'admission_date', 'discharge_date'],
        inventory: ['drug_name', 'quantity', 'unit_cost', 'expiry_date', 'supplier', 'category']
      }
    };
    this.pythonScriptsDir = path.join(__dirname, 'generated_scripts');
    this.ensureScriptsDirectory();
  }

  ensureScriptsDirectory() {
    if (!fs.existsSync(this.pythonScriptsDir)) {
      fs.mkdirSync(this.pythonScriptsDir, { recursive: true });
    }
  }

  async processQuery(userQuery, dbPath) {
    try {
      // Add user query to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: userQuery,
        timestamp: new Date().toISOString()
      });

      // Generate Python code based on the query
      const pythonCode = await this.generatePythonCode(userQuery, dbPath);
      
      // Execute the generated Python code
      const results = await this.executePythonCode(pythonCode);
      
      // Generate natural language response
      const response = await this.generateResponse(userQuery, results);
      
      // Add assistant response to conversation history
      this.conversationHistory.push({
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
        pythonCode: pythonCode,
        results: results
      });

      return {
        response,
        pythonCode,
        results,
        conversationId: uuidv4()
      };
    } catch (error) {
      console.error('Error processing query:', error);
      return {
        response: `I encountered an error while processing your query: ${error.message}`,
        error: true
      };
    }
  }

  async generatePythonCode(userQuery, dbPath) {
    const systemPrompt = `You are DeepScanRx, an AI assistant that generates Python code for healthcare data analysis.

Available database tables and schema:
- patients: ${this.context.dataSchema.patients.join(', ')}
- inventory: ${this.context.dataSchema.inventory.join(', ')}

Database path: ${dbPath}

Generate Python code that:
1. Connects to the SQLite database
2. Analyzes the data based on the user's query
3. Returns structured results (JSON format when possible)
4. Includes proper error handling
5. Uses libraries like pandas, sqlite3, matplotlib, seaborn for analysis
6. Saves any visualizations to files in the current directory

Previous conversation context:
${this.conversationHistory.slice(-4).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

User Query: ${userQuery}

Return ONLY the Python code, no explanations or markdown formatting.`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userQuery }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    return completion.choices[0].message.content.trim();
  }

  async executePythonCode(pythonCode) {
    const scriptId = uuidv4();
    const scriptPath = path.join(this.pythonScriptsDir, `script_${scriptId}.py`);
    
    try {
      // Write Python code to file
      fs.writeFileSync(scriptPath, pythonCode);
      
      // Execute Python script
      const results = await new Promise((resolve, reject) => {
        PythonShell.run(scriptPath, {
          mode: 'text',
          pythonOptions: ['-u'],
          scriptPath: this.pythonScriptsDir
        }, (err, results) => {
          if (err) {
            reject(err);
          } else {
            resolve(results ? results.join('\n') : '');
          }
        });
      });

      // Clean up script file
      fs.unlinkSync(scriptPath);
      
      return results;
    } catch (error) {
      // Clean up script file on error
      if (fs.existsSync(scriptPath)) {
        fs.unlinkSync(scriptPath);
      }
      throw error;
    }
  }

  async generateResponse(userQuery, pythonResults) {
    const systemPrompt = `You are DeepScanRx, an AI assistant for healthcare analytics. 
    
Generate a natural language response based on the user's query and the Python analysis results.
Be professional, insightful, and provide actionable recommendations for hospital pharmacy management.

Conversation history:
${this.conversationHistory.slice(-4).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

User Query: ${userQuery}
Python Analysis Results: ${pythonResults}

Provide a comprehensive response that explains the findings and offers practical recommendations.`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Query: ${userQuery}\nResults: ${pythonResults}` }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    return completion.choices[0].message.content.trim();
  }

  getConversationHistory() {
    return this.conversationHistory;
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  updateContext(key, value) {
    this.context[key] = value;
  }
}

module.exports = DeepScanRxAgent;