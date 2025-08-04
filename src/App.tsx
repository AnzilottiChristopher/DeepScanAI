import React, { useState, useEffect } from 'react';
import { Upload, Database, Brain, BarChart3, MessageCircle, FileText, TrendingUp, AlertTriangle, DollarSign, Activity } from 'lucide-react';
import { localApi } from './lib/localApi';

// Check if we're in local development mode (no Supabase URL)
const isLocalMode = !import.meta.env.VITE_SUPABASE_URL;

interface Stats {
  patients: number;
  inventory: number;
}

interface AnalyticsResult {
  summary?: any;
  recommendations?: any[];
  predictions?: any[];
  total_inventory_value?: number;
  high_value_items?: any[];
  cost_saving_opportunities?: any[];
  potential_total_savings?: number;
  efficiency_score?: string;
}

interface Patient {
  id: number;
  patient_id: string;
  age?: number;
  gender?: string;
  diagnosis?: string;
  medications?: string;
  admission_date?: string;
  discharge_date?: string;
  created_at?: string;
}
interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  action?: string;
  suggestions?: string[];
  pythonCode?: string;
  analysisResults?: string;
}

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<Stats>({ patients: 0, inventory: 0 });
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [analytics, setAnalytics] = useState<AnalyticsResult>({});
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: "Hello! I'm DeepScanRx, your AI-powered healthcare analytics assistant. I can analyze your patient and inventory data, generate Python code for complex queries, predict trends, and provide actionable insights. Upload your CSV files and ask me anything about your healthcare data!",
      sender: 'assistant',
      timestamp: new Date().toISOString(),
      suggestions: [
        "Show me inventory optimization opportunities",
        "Predict drug demand for next quarter", 
        "Find cost-saving opportunities in my data",
        "Generate a comprehensive analytics report",
        "Analyze patient medication patterns"
      ]
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      let data;
      if (isLocalMode) {
        data = await localApi.getStats();
      } else {
        const response = await fetch('/.netlify/functions/stats');
        data = await response.json();
      }
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchPatients = async () => {
    setLoadingPatients(true);
    try {
      let data;
      if (isLocalMode) {
        data = await localApi.getPatients();
      } else {
        const response = await fetch('/.netlify/functions/patients');
        data = await response.json();
      }
      setPatients(data);
    } catch (error) {
      console.error('Error fetching patients:', error);
      setPatients([]);
    } finally {
      setLoadingPatients(false);
    }
  };
  const handleFileUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    setUploadStatus('Uploading...');
    
    try {
      let result;
      if (isLocalMode) {
        result = await localApi.uploadCsv(formData);
      } else {
        const response = await fetch('/.netlify/functions/upload', {
          method: 'POST',
          body: formData,
        });
        result = await response.json();
      }
      
      if (result.recordsProcessed) {
        setUploadStatus(`Success: ${result.recordsProcessed} records processed`);
        fetchStats();
        // Refresh patients data if we uploaded patient data
        if (result.dataType === 'patients') {
          fetchPatients();
        }
      } else {
        setUploadStatus(`Error: ${result.error}`);
      }
    } catch (error) {
      setUploadStatus('Error: Failed to upload file');
    }
  };

  const runAnalytics = async (type: string) => {
    try {
      let data;
      
      if (isLocalMode) {
        switch(type) {
          case 'inventory-optimization':
            data = await localApi.getInventoryAnalytics();
            break;
          case 'drug-demand-prediction':
            data = await localApi.getDemandPrediction();
            break;
          case 'cost-optimization':
            data = await localApi.getCostOptimization();
            break;
          default:
            throw new Error(`Unknown analytics type: ${type}`);
        }
      } else {
        let endpoint = '';
        switch(type) {
          case 'inventory-optimization':
            endpoint = '/.netlify/functions/analytics-inventory';
            break;
          case 'drug-demand-prediction':
            endpoint = '/.netlify/functions/analytics-demand';
            break;
          case 'cost-optimization':
            endpoint = '/.netlify/functions/analytics-cost';
            break;
          default:
            endpoint = `/.netlify/functions/analytics-${type}`;
        }
        const response = await fetch(endpoint);
        data = await response.json();
      }
      
      setAnalytics(prev => ({ ...prev, [type]: data }));
    } catch (error) {
      console.error('Error running analytics:', error);
    }
  };

  const sendMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: currentMessage,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');

    try {

      let result;
      if (isLocalMode) {
        result = await localApi.sendChatMessage(currentMessage);
      } else {
        const response = await fetch('/.netlify/functions/ai-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: currentMessage,
            context: { stats, analytics }
          }),
        });
        result = await response.json();
      }
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: result.response.text,
        sender: 'assistant',
        timestamp: result.timestamp,
        action: result.response.action,
        suggestions: result.response.suggestions,
        pythonCode: result.pythonCode,
        analysisResults: result.analysisResults
      };

      setChatMessages(prev => [...prev, assistantMessage]);

      // Refresh stats after AI analysis
      if (result.response.action === 'analysis_complete') {
        fetchStats();
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        text: "I'm sorry, I encountered an error processing your request. Please try again or rephrase your question.",
        sender: 'assistant',
        timestamp: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    }
  };

  const generateReport = async () => {
    try {
      let result;
      if (isLocalMode) {
        result = await localApi.generateReport();
      } else {
        const response = await fetch('/.netlify/functions/generate-report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        result = await response.json();
      }
      
      const reportMessage: ChatMessage = {
        id: Date.now().toString(),
        text: result.report,
        sender: 'assistant',
        timestamp: result.generatedAt,
        pythonCode: result.pythonCode,
        analysisResults: result.analysisResults
      };
      
      setChatMessages(prev => [...prev, reportMessage]);
      setActiveTab('assistant');
      
    } catch (error) {
      console.error('Error generating report:', error);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setCurrentMessage(suggestion);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-blue-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">DeepScanRx</h1>
                <p className="text-sm text-gray-600">Healthcare AI Analytics Platform</p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <p className="text-sm text-gray-500">Data Records</p>
                <p className="text-lg font-semibold text-gray-900">
                  {stats.patients + stats.inventory} total
                </p>
                {isLocalMode && (
                  <p className="text-xs text-orange-600">Local Mode</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'dashboard', name: 'Dashboard', icon: BarChart3 },
              { id: 'patients', name: 'Patients', icon: Activity },
              { id: 'upload', name: 'Data Upload', icon: Upload },
              { id: 'analytics', name: 'Analytics', icon: TrendingUp },
              { id: 'assistant', name: 'AI Assistant', icon: MessageCircle },
              { id: 'reports', name: 'Reports', icon: FileText },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                <span>{tab.name}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Patient Records</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.patients}</p>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Activity className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Inventory Items</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.inventory}</p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-lg">
                    <Database className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">AI Insights</p>
                    <p className="text-3xl font-bold text-gray-900">Active</p>
                  </div>
                  <div className="bg-purple-100 p-3 rounded-lg">
                    <Brain className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Optimization</p>
                    <p className="text-3xl font-bold text-gray-900">92%</p>
                  </div>
                  <div className="bg-orange-100 p-3 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => runAnalytics('inventory-optimization')}
                    className="w-full flex items-center space-x-3 p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">Run Inventory Analysis</span>
                  </button>
                  <button
                    onClick={() => runAnalytics('drug-demand-prediction')}
                    className="w-full flex items-center space-x-3 p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Predict Drug Demand</span>
                  </button>
                  <button
                    onClick={() => runAnalytics('cost-optimization')}
                    className="w-full flex items-center space-x-3 p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                  >
                    <DollarSign className="h-5 w-5 text-purple-600" />
                    <span className="text-sm font-medium text-purple-700">Cost Optimization</span>
                  </button>
                  <button
                    onClick={generateReport}
                    className="w-full flex items-center space-x-3 p-3 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                  >
                    <FileText className="h-5 w-5 text-indigo-600" />
                    <span className="text-sm font-medium text-indigo-700">Generate AI Report</span>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Database Connection</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {isLocalMode ? 'Local Mode' : 'Connected'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">AI Engine</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {isLocalMode ? 'Mock Mode' : 'Active'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Data Processing</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Ready
                    </span>
                  </div>
                  {isLocalMode && (
                    <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-sm text-orange-800">
                        <strong>Local Development Mode</strong><br/>
                        Using mock data. Set VITE_SUPABASE_URL to connect to real database.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'patients' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Patient Records</h2>
                <p className="text-gray-600">View and manage patient data</p>
              </div>
              <button
                onClick={fetchPatients}
                disabled={loadingPatients}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
              >
                <Activity className="h-4 w-4" />
                <span>{loadingPatients ? 'Loading...' : 'Refresh Data'}</span>
              </button>
            </div>

            {patients.length === 0 && !loadingPatients && (
              <div className="bg-white rounded-xl shadow-md p-8 text-center border border-gray-100">
                <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Patient Data</h3>
                <p className="text-gray-600 mb-4">
                  Upload patient CSV files to view data here
                </p>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Upload Patient Data
                </button>
              </div>
            )}

            {loadingPatients && (
              <div className="bg-white rounded-xl shadow-md p-8 text-center border border-gray-100">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading patient data...</p>
              </div>
            )}

            {patients.length > 0 && !loadingPatients && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Patient Records ({patients.length} total)
                  </h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Patient ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Age
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Gender
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Diagnosis
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Medications
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Admission
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Discharge
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {patients.map((patient) => (
                        <tr key={patient.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {patient.patient_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {patient.age || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {patient.gender || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {patient.diagnosis || 'Not specified'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                            <div className="truncate" title={patient.medications || ''}>
                              {patient.medications || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {patient.admission_date || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {patient.discharge_date || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
              <div className="text-center mb-8">
                <Upload className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Data Files</h2>
                <p className="text-gray-600">Upload CSV files containing patient data or inventory information</p>
              </div>

              <form onSubmit={handleFileUpload} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data Type
                  </label>
                  <select
                    name="dataType"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select data type...</option>
                    <option value="patients">Patient Data</option>
                    <option value="inventory">Inventory Data</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CSV File
                  </label>
                  <input
                    type="file"
                    name="csvFile"
                    accept=".csv"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  Upload and Process
                </button>
              </form>

              {uploadStatus && (
                <div className={`mt-4 p-4 rounded-lg ${
                  uploadStatus.includes('Success') 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {uploadStatus}
                  {isLocalMode && uploadStatus.includes('Success') && (
                    <p className="text-sm mt-2 text-green-600">
                      Note: Running in local mode with mock data processing
                    </p>
                  )}
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Expected CSV Format</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Patient Data Fields:</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• patient_id</li>
                      <li>• age</li>
                      <li>• gender</li>
                      <li>• diagnosis</li>
                      <li>• medications</li>
                      <li>• outcomes</li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Inventory Data Fields:</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• drug_name</li>
                      <li>• current_stock</li>
                      <li>• minimum_threshold</li>
                      <li>• unit_cost</li>
                      <li>• expiry_date</li>
                      <li>• supplier</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <button
                onClick={() => runAnalytics('inventory-optimization')}
                className="bg-white rounded-xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow text-left"
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <BarChart3 className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Inventory Optimization</h3>
                </div>
                <p className="text-sm text-gray-600">Analyze stock levels and generate reorder recommendations</p>
              </button>

              <button
                onClick={() => runAnalytics('drug-demand-prediction')}
                className="bg-white rounded-xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow text-left"
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Demand Prediction</h3>
                </div>
                <p className="text-sm text-gray-600">Predict future drug demand based on patient data</p>
              </button>

              <button
                onClick={() => runAnalytics('cost-optimization')}
                className="bg-white rounded-xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow text-left"
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div className="bg-purple-100 p-2 rounded-lg">
                    <DollarSign className="h-6 w-6 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Cost Optimization</h3>
                </div>
                <p className="text-sm text-gray-600">Identify cost-saving opportunities in inventory</p>
              </button>
            </div>

            {/* Analytics Results */}
            {Object.keys(analytics).length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Analytics Results</h3>
                
                {analytics['inventory-optimization'] && (
                  <div className="mb-8">
                    <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <BarChart3 className="h-5 w-5 text-blue-600 mr-2" />
                      Inventory Optimization
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-blue-600 font-medium">Total Items</p>
                        <p className="text-2xl font-bold text-blue-900">{analytics['inventory-optimization'].summary?.total_items || 0}</p>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg">
                        <p className="text-sm text-red-600 font-medium">Low Stock</p>
                        <p className="text-2xl font-bold text-red-900">{analytics['inventory-optimization'].summary?.low_stock || 0}</p>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <p className="text-sm text-orange-600 font-medium">Over Stock</p>
                        <p className="text-2xl font-bold text-orange-900">{analytics['inventory-optimization'].summary?.over_stock || 0}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-green-600 font-medium">Efficiency Score</p>
                        <p className="text-2xl font-bold text-green-900">{analytics['inventory-optimization'].efficiency_score || 0}%</p>
                      </div>
                    </div>
                    
                    {analytics['inventory-optimization'].recommendations && analytics['inventory-optimization'].recommendations.length > 0 && (
                      <div>
                        <h5 className="font-medium text-gray-900 mb-3">Recommendations</h5>
                        <div className="space-y-2">
                          {analytics['inventory-optimization'].recommendations.slice(0, 5).map((rec: any, index: number) => (
                            <div key={index} className={`p-3 rounded-lg border-l-4 ${
                              rec.priority === 'high' ? 'bg-red-50 border-red-400' : 
                              rec.priority === 'medium' ? 'bg-orange-50 border-orange-400' : 
                              'bg-yellow-50 border-yellow-400'
                            }`}>
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium text-gray-900">{rec.drug}</p>
                                  <p className="text-sm text-gray-600">{rec.reason}</p>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  rec.priority === 'high' ? 'bg-red-100 text-red-800' :
                                  rec.priority === 'medium' ? 'bg-orange-100 text-orange-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {rec.priority}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500 mt-1">
                                Current: {rec.current} → Recommended: {rec.recommended}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {analytics['drug-demand-prediction'] && (
                  <div className="mb-8">
                    <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
                      Demand Predictions
                    </h4>
                    {analytics['drug-demand-prediction'].predictions && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medication</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Historical</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Predicted</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trend</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {analytics['drug-demand-prediction'].predictions.slice(0, 5).map((pred: any, index: number) => (
                              <tr key={index}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{pred.medication}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pred.historical_usage}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pred.predicted_demand}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    pred.trend === 'increasing' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {pred.trend}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {analytics['cost-optimization'] && (
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <DollarSign className="h-5 w-5 text-purple-600 mr-2" />
                      Cost Optimization
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-purple-600 font-medium">Total Inventory Value</p>
                        <p className="text-2xl font-bold text-purple-900">
                          ${analytics['cost-optimization'].total_inventory_value?.toLocaleString() || 0}
                        </p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-green-600 font-medium">Potential Savings</p>
                        <p className="text-2xl font-bold text-green-900">
                          ${analytics['cost-optimization'].potential_total_savings?.toLocaleString() || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'assistant' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 flex flex-col h-[600px]">
              <div className="border-b border-gray-200 p-6">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <MessageCircle className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">AI Assistant</h2>
                    <p className="text-sm text-gray-600">Get insights and analysis from your healthcare data</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-3xl p-4 rounded-lg ${
                        message.sender === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-sm">{message.text}</p>
                      {message.suggestions && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.suggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              onClick={() => handleSuggestionClick(suggestion)}
                              className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-xs hover:bg-opacity-30 transition-colors"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                      {message.pythonCode && (
                        <details className="mt-3">
                          <summary className="text-xs cursor-pointer text-gray-400 hover:text-gray-600">
                            View Generated Python Code
                          </summary>
                          <pre className="mt-2 p-2 bg-black bg-opacity-10 rounded text-xs overflow-x-auto">
                            <code>{message.pythonCode}</code>
                          </pre>
                        </details>
                      )}
                      {message.analysisResults && (
                        <details className="mt-3">
                          <summary className="text-xs cursor-pointer text-gray-400 hover:text-gray-600">
                            View Analysis Results
                          </summary>
                          <pre className="mt-2 p-2 bg-black bg-opacity-10 rounded text-xs overflow-x-auto">
                            <code>{message.analysisResults}</code>
                          </pre>
                        </details>
                      )}
                      <p className="text-xs opacity-70 mt-2">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 p-6">
                <div className="flex space-x-3">
                  <input
                    type="text"
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Ask me anything about your healthcare data - I can generate Python code and provide insights..."
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={sendMessage}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-8">
            <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
              <div className="text-center mb-8">
                <FileText className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">AI-Generated Reports</h2>
                <p className="text-gray-600">Generate comprehensive analytics reports using AI</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <button
                  onClick={generateReport}
                  className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 hover:shadow-md transition-all"
                >
                  <div className="flex items-center space-x-3 mb-3">
                    <Brain className="h-8 w-8 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Comprehensive AI Report</h3>
                  </div>
                  <p className="text-sm text-gray-600 text-left">
                    Generate a complete analysis including inventory optimization, demand predictions, 
                    cost savings, and patient trends with AI-generated Python code.
                  </p>
                </button>

                <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center space-x-3 mb-3">
                    <BarChart3 className="h-8 w-8 text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Custom Analysis</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Use the AI Assistant to ask specific questions and get custom analysis 
                    with dynamically generated Python code.
                  </p>
                  <button
                    onClick={() => setActiveTab('assistant')}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Go to AI Assistant →
                  </button>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800">
                      {isLocalMode ? 'Local Development Mode' : 'AI Configuration Required'}
                    </h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      {isLocalMode 
                        ? 'Currently running with mock data. Connect to Supabase and configure OpenAI API for full functionality.'
                        : 'To use AI-powered features, you need to configure your OpenAI API key in the server environment.'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;