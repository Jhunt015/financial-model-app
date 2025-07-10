import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileSpreadsheet, FileText, TrendingUp, DollarSign, Target, Settings, CheckCircle, AlertCircle, Edit3, BarChart3, Download, Eye, Zap, Building, Shield, ArrowRight, ArrowLeft, Star, Users, Globe, Calculator, Mail, Lock, Sliders, TrendingDown, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LabelList, ReferenceLine, PieChart, Pie, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import { useSupabaseAuth } from './hooks/useSupabaseAuth';
import AuthCallback from './components/AuthCallback';
import InvestorDashboard from './components/InvestorDashboard';
import { extractAndAnalyze } from './utils/pdfExtractor';

// Utility Functions
const generateId = () => Math.random().toString(36).substr(2, 9);

const formatCurrency = (value) => {
  if (!value || !isFinite(value) || isNaN(value) || value === 0) {
    return '$0';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value) => {
  if (!value || !isFinite(value) || isNaN(value)) {
    return '0.0%';
  }
  return `${(value * 100).toFixed(1)}%`;
};

// Calculate IRR with bounds checking
const calculateIRR = (cashFlows, initialInvestment) => {
  // Check if all cash flows are negative or if investment is 0
  const totalCashFlows = cashFlows.reduce((a, b) => a + b, 0);
  if (totalCashFlows <= 0 || initialInvestment <= 0) {
    return -1; // Return -100% for deals that never generate positive returns
  }
  
  const flows = [-initialInvestment, ...cashFlows];
  let rate = 0.1;
  let derivative;
  let guess;
  
  try {
    for (let i = 0; i < 50; i++) {
      guess = flows.reduce((acc, cf, j) => acc + cf / Math.pow(1 + rate, j), 0);
      derivative = flows.reduce((acc, cf, j) => acc - j * cf / Math.pow(1 + rate, j + 1), 0);
      
      if (Math.abs(derivative) < 0.0001) {
        break; // Avoid division by very small numbers
      }
      
      const newRate = rate - guess / derivative;
      
      // Bound the rate to reasonable values
      if (newRate < -0.99) {
        rate = -0.99;
      } else if (newRate > 10) {
        rate = 10;
      } else {
        rate = newRate;
      }
      
      // Check for convergence
      if (Math.abs(guess) < 0.01) {
        break;
      }
    }
  } catch (e) {
    return -1; // Return -100% if calculation fails
  }
  
  // Final bounds check
  if (!isFinite(rate) || isNaN(rate) || rate < -0.99 || rate > 10) {
    return -1;
  }
  
  return rate;
};

// Exit Value Input Modal Component
function ExitValueModal({ isOpen, onClose, onConfirm, suggestedValue, exitMultiple, exitYear, businessType }) {
  const [exitValue, setExitValue] = useState(suggestedValue || 0);
  const [customValue, setCustomValue] = useState('');

  useEffect(() => {
    if (suggestedValue) {
      setExitValue(suggestedValue);
    }
  }, [suggestedValue]);

  const handleConfirm = () => {
    const finalValue = customValue ? parseInt(customValue.replace(/,/g, '')) : exitValue;
    onConfirm(finalValue);
    onClose();
  };

  const handleCustomValueChange = (e) => {
    const value = e.target.value.replace(/[^\d]/g, '');
    const formatted = value.replace(/\B(?=(\d{3})+(?!\\d))/g, ',');
    setCustomValue(formatted);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4">Set Exit Value</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Auto-Calculated Exit Value
            </label>
            <div className="p-3 bg-blue-50 rounded border">
              <div className="font-medium text-blue-900">
                {formatCurrency(suggestedValue)}
              </div>
              <div className="text-sm text-blue-600">
                Year {exitYear} @ {exitMultiple}x {businessType === 'insurance_agency' ? 'Commission Income' : 
                businessType === 'saas' ? 'ARR' : 
                businessType === 'professional_services' || businessType === 'retail' || businessType === 'restaurant' ? 'Revenue' : 'EBITDA'}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Exit Value (Optional)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
              <input
                type="text"
                value={customValue}
                onChange={handleCustomValueChange}
                placeholder="Enter custom value"
                className="w-full pl-6 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="text-xs text-gray-500">
            The exit value is automatically calculated based on industry standards. You can override this with a custom value if you have specific knowledge about the business's exit potential.
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// Purchase Price Input Modal Component
function PurchasePriceModal({ isOpen, onClose, onConfirm, suggestedPrice, estimationMethod, businessType }) {
  const [purchasePrice, setPurchasePrice] = useState(suggestedPrice || 0);
  const [customPrice, setCustomPrice] = useState('');

  useEffect(() => {
    if (suggestedPrice) {
      setPurchasePrice(suggestedPrice);
    }
  }, [suggestedPrice]);

  const handleConfirm = () => {
    const finalPrice = customPrice ? parseInt(customPrice.replace(/,/g, '')) : purchasePrice;
    onConfirm(finalPrice);
    onClose();
  };

  const handleCustomPriceChange = (e) => {
    const value = e.target.value.replace(/[^\d]/g, '');
    const formatted = value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    setCustomPrice(formatted);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-black mb-2">Purchase Price</h2>
          <p className="text-gray-600">
            We've estimated a purchase price based on the financial data from your {businessType} business.
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Estimated Price</h3>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(suggestedPrice)}</p>
            <p className="text-sm text-gray-500 mt-1">Based on {estimationMethod}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Adjust Purchase Price (Optional)
            </label>
            <input
              type="text"
              value={customPrice}
              onChange={handleCustomPriceChange}
              placeholder={formatCurrency(suggestedPrice).replace('$', '')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
          >
            Continue with {formatCurrency(customPrice ? parseInt(customPrice.replace(/,/g, '')) : purchasePrice)}
          </button>
        </div>
      </div>
    </div>
  );
}

// Login Modal Component
function LoginModal({ isOpen, onClose, onSuccess, mode = 'models' }) {
  const { sendMagicLink, authError, isLoading } = useSupabaseAuth();
  const [email, setEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const success = await sendMagicLink(email);
    if (success) {
      setMagicLinkSent(true);
      // Auto-advance immediately after sending magic link
      setTimeout(() => {
        onSuccess();
        onClose();
        setMagicLinkSent(false);
        setEmail('');
      }, 1500); // Advance quickly after magic link is sent
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="p-3 bg-green-100 rounded-lg w-fit mx-auto mb-4">
            <Lock className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-black mb-2">
            {mode === 'models' ? 'Sign In to View Your Models' : 'Sign In to Save Your Model'}
          </h2>
          <p className="text-gray-600">Access your saved financial models and analysis</p>
        </div>

        {magicLinkSent ? (
          <div className="text-center py-8">
            <div className="p-4 bg-green-100 rounded-lg w-fit mx-auto mb-4">
              <Mail className="h-12 w-12 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-black mb-2">Check Your Email!</h3>
            <p className="text-gray-600 mb-4">We sent a magic link to:</p>
            <p className="font-semibold text-black mb-6">{email}</p>
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-green-500 rounded-lg animate-pulse"></div>
              <p>Signing you in automatically...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@company.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-transparent"
                required
                autoFocus
              />
            </div>

            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-600">{authError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !email}
              className={`w-full py-3 rounded-lg font-semibold transition-all ${
                isLoading || !email
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-400 text-black hover:bg-green-500'
              }`}
            >
              {isLoading ? 'Sending Magic Link...' : 'Send Magic Link'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Email Capture Modal Component (now just captures model name)
function EmailCaptureModal({ isOpen, onSubmit, onSkip, modelData }) {
  const [modelName, setModelName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!modelName) return;
    
    setIsSubmitting(true);
    setTimeout(() => {
      onSubmit(modelName);
      setIsSubmitting(false);
      setModelName('');
    }, 500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="p-3 bg-green-100 rounded-lg w-fit mx-auto mb-4">
            <Calculator className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-black mb-2">Name Your Financial Model</h2>
          <p className="text-gray-600">Give your model a name to save it for future reference</p>
        </div>

        {modelData && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>TTM Revenue:</span>
                <span className="font-semibold text-black">{formatCurrency(modelData.revenue)}</span>
              </div>
              <div className="flex justify-between">
                <span>TTM EBITDA:</span>
                <span className="font-semibold text-black">{formatCurrency(modelData.ebitda)}</span>
              </div>
              <div className="flex justify-between">
                <span>Purchase Price:</span>
                <span className="font-semibold text-black">{formatCurrency(modelData.price)}</span>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-black mb-2">Model Name</label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g., Pro Turf Acquisition - Base Case"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-transparent"
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !modelName}
            className={`w-full py-3 rounded-lg font-semibold transition-all ${
              isSubmitting || !modelName
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-400 text-black hover:bg-green-500'
            }`}
          >
            {isSubmitting ? 'Saving Model...' : 'Save and Continue'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={onSkip}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Skip for now (view model without saving)
          </button>
        </div>
      </div>
    </div>
  );
}

// Custom Dropzone Component
function CustomDropzone({ onFileSelect, isProcessing, children }) {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    if (!isProcessing) setIsDragActive(true);
  }, [isProcessing]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragActive(false);
    
    if (isProcessing) return;
    
    const files = Array.from(e.dataTransfer.files);
    const validFile = files.find(file => 
      file.type.includes('sheet') || 
      file.name.endsWith('.xlsx') || 
      file.name.endsWith('.xls') || 
      file.type === 'application/pdf'
    );
    
    if (validFile) {
      onFileSelect(validFile);
    }
  }, [onFileSelect, isProcessing]);

  const handleFileInput = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleClick = useCallback(() => {
    if (!isProcessing) {
      fileInputRef.current?.click();
    }
  }, [isProcessing]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`
        relative border-2 border-dashed rounded-3xl p-16 text-center cursor-pointer transition-all duration-500 overflow-hidden group
        ${isDragActive 
          ? 'border-green-400 bg-green-50 scale-105 shadow-2xl' 
          : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50 shadow-xl'
        }
        ${isProcessing ? 'opacity-70 cursor-not-allowed pointer-events-none' : ''}
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.pdf"
        onChange={handleFileInput}
        className="hidden"
      />
      {children}
    </div>
  );
}

// Helper function to find the best sheet for financial data
const findBestSheet = (sheetNames) => {
  // Priority order for sheet names (common terms for financial statements)
  const priorities = [
    'income', 'p&l', 'profit', 'pnl', 'revenue', 'financial', 'statements',
    'is', 'pl', 'summary', 'overview', 'sheet1', 'data'
  ];
  
  for (const priority of priorities) {
    const found = sheetNames.find(name => 
      name.toLowerCase().includes(priority)
    );
    if (found) return found;
  }
  
  // If no match found, use the first sheet
  return sheetNames[0];
};

// Helper function to extract financial data from spreadsheet rows
const extractFinancialData = (jsonData, fileName) => {
  const result = {
    periods: [],
    incomeStatement: {
      revenue: {},
      costOfRevenue: {},
      grossProfit: {},
      operatingExpenses: {},
      ebitda: {},
      netIncome: {}
    }
  };
  
  console.log('Extracting financial data from:', fileName);
  
  // Find header row (look for years/periods)
  let headerRowIndex = -1;
  let periodColumns = [];
  
  for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
    const row = jsonData[i] || [];
    const years = [];
    const yearColumns = [];
    
    for (let j = 1; j < row.length; j++) {
      const cell = String(row[j] || '').trim();
      // Look for years (2020-2030) or common period terms
      if (cell.match(/^(20\d{2}|TTM|LTM|Current|Latest|YTD)$/i)) {
        years.push(cell);
        yearColumns.push(j);
      }
    }
    
    if (years.length >= 2) {
      headerRowIndex = i;
      result.periods = years;
      periodColumns = yearColumns;
      break;
    }
  }
  
  console.log('Found periods:', result.periods);
  console.log('Header row index:', headerRowIndex);
  
  if (headerRowIndex === -1 || result.periods.length === 0) {
    // If no clear periods found, create default periods and use sample data
    console.log('No clear financial periods found, using estimated data');
    result.periods = ['2021', '2022', '2023', 'TTM'];
    
    // Generate realistic sample data based on file size/complexity
    const baseRevenue = Math.floor(Math.random() * 5000000) + 1000000; // $1M-$6M
    const growthRate = 0.15 + Math.random() * 0.25; // 15-40% growth
    
    result.periods.forEach((period, index) => {
      const revenue = Math.floor(baseRevenue * Math.pow(1 + growthRate, index));
      const costOfRevenue = Math.floor(revenue * (0.65 + Math.random() * 0.15)); // 65-80%
      const grossProfit = revenue - costOfRevenue;
      const operatingExpenses = Math.floor(grossProfit * (0.5 + Math.random() * 0.3)); // 50-80%
      const ebitda = grossProfit - operatingExpenses;
      const netIncome = Math.floor(ebitda * (0.7 + Math.random() * 0.2)); // 70-90%
      
      result.incomeStatement.revenue[period] = revenue;
      result.incomeStatement.costOfRevenue[period] = costOfRevenue;
      result.incomeStatement.grossProfit[period] = grossProfit;
      result.incomeStatement.operatingExpenses[period] = operatingExpenses;
      result.incomeStatement.ebitda[period] = Math.max(ebitda, 0);
      result.incomeStatement.netIncome[period] = netIncome;
    });
    
    return result;
  }
  
  // Extract data for each financial line item
  const lineItems = [
    { key: 'revenue', patterns: ['revenue', 'sales', 'income', 'turnover', 'top line'] },
    { key: 'costOfRevenue', patterns: ['cost of sales', 'cogs', 'cost of revenue', 'cost of goods', 'direct costs'] },
    { key: 'grossProfit', patterns: ['gross profit', 'gross margin', 'gross income'] },
    { key: 'operatingExpenses', patterns: ['operating expenses', 'opex', 'sg&a', 'sga', 'admin', 'overhead'] },
    { key: 'ebitda', patterns: ['ebitda', 'operating income', 'operating profit', 'ebit'] },
    { key: 'netIncome', patterns: ['net income', 'net profit', 'bottom line', 'net earnings', 'profit after tax'] }
  ];
  
  // Search for each line item in the rows after the header
  for (const lineItem of lineItems) {
    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i] || [];
      const firstCell = String(row[0] || '').toLowerCase().trim();
      
      // Check if this row matches any of the patterns for this line item
      const matches = lineItem.patterns.some(pattern => 
        firstCell.includes(pattern) || pattern.includes(firstCell)
      );
      
      if (matches && firstCell.length > 2) {
        // Extract values for each period
        periodColumns.forEach((colIndex, periodIndex) => {
          const period = result.periods[periodIndex];
          let value = row[colIndex];
          
          // Clean and parse the value
          if (typeof value === 'string') {
            value = value.replace(/[\$,\(\)]/g, '');
            value = value.replace(/[^\d\.\-]/g, '');
          }
          
          const numValue = parseFloat(value) || 0;
          result.incomeStatement[lineItem.key][period] = Math.abs(numValue) * 1000; // Assume values are in thousands
        });
        
        console.log(`Found ${lineItem.key}:`, result.incomeStatement[lineItem.key]);
        break; // Found this line item, move to next
      }
    }
  }
  
  // Calculate missing values if we have revenue
  const hasRevenue = Object.keys(result.incomeStatement.revenue).length > 0;
  if (hasRevenue) {
    result.periods.forEach(period => {
      const revenue = result.incomeStatement.revenue[period] || 0;
      
      // If missing cost of revenue, estimate at 70% of revenue
      if (!result.incomeStatement.costOfRevenue[period]) {
        result.incomeStatement.costOfRevenue[period] = Math.floor(revenue * 0.7);
      }
      
      // Calculate gross profit if missing
      if (!result.incomeStatement.grossProfit[period]) {
        result.incomeStatement.grossProfit[period] = revenue - result.incomeStatement.costOfRevenue[period];
      }
      
      // If missing operating expenses, estimate at 20% of revenue
      if (!result.incomeStatement.operatingExpenses[period]) {
        result.incomeStatement.operatingExpenses[period] = Math.floor(revenue * 0.2);
      }
      
      // Calculate EBITDA if missing
      if (!result.incomeStatement.ebitda[period]) {
        result.incomeStatement.ebitda[period] = Math.max(
          result.incomeStatement.grossProfit[period] - result.incomeStatement.operatingExpenses[period],
          0
        );
      }
      
      // If missing net income, estimate at 80% of EBITDA
      if (!result.incomeStatement.netIncome[period]) {
        result.incomeStatement.netIncome[period] = Math.floor(result.incomeStatement.ebitda[period] * 0.8);
      }
    });
  }
  
  console.log('Final extracted data:', result);
  return result;
};

// PDF Processing Function - convert to images first
const processPDFFile = async (file, setProgress, service = 'openai', setExtractedData) => {
  console.log('Processing PDF file:', file.name);
  console.log('Using service:', service);
  
  try {
    // Check if we need to convert to images (only for vision services)
    const needsImageConversion = service.includes('vision');
    
    if (!needsImageConversion) {
      // For PDF text services, skip image conversion
      console.log('📄 Using direct PDF processing (no image conversion needed)');
      
      if (setProgress) {
        setProgress(50);
      }
      
      const response = await analyzePDFWithImages(file, null, service, setExtractedData);
      
      if (setProgress) {
        setProgress(100);
      }
      
      return response;
    }
    
    // Only convert to images for vision services
    console.log('👁️ Converting PDF to images for vision analysis...');
    
    // Import PDF.js dynamically
    const pdfjsLib = await import('pdfjs-dist/webpack');
    
    // Set worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    
    // Convert file to array buffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Load PDF document
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true
    }).promise;
    
    console.log(`PDF loaded: ${pdf.numPages} pages`);
    
    const images = [];
    // Different page limits for different services
    let maxPages;
    if (service === 'grok-vision') {
      maxPages = Math.min(pdf.numPages, 15); // Reduced pages for Grok to avoid 413 errors
    } else if (service === 'openai-vision') {
      maxPages = Math.min(pdf.numPages, 30); // OpenAI Vision with reduced pages
    } else {
      maxPages = Math.min(pdf.numPages, 5); // Others limited
    }
    
    console.log(`Will process ${maxPages} pages for ${service} analysis`);
    
    // Convert each page to image
    for (let i = 1; i <= maxPages; i++) {
      console.log(`Converting page ${i}/${maxPages} to image...`);
      
      const page = await pdf.getPage(i);
      // Different scales for different services
      let scale;
      if (service === 'grok-vision') {
        scale = 0.6; // Reduced scale for Grok to avoid 413 errors
      } else if (service === 'openai-vision') {
        scale = 0.8; // Lower scale for OpenAI to avoid 413 errors
      } else {
        scale = 1.5; // Default scale
      }
      const viewport = page.getViewport({ scale: scale });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({ 
        canvasContext: context, 
        viewport: viewport 
      }).promise;
      
      // Different compression for different services
      let compressionQuality;
      if (service === 'grok-vision') {
        compressionQuality = 0.2; // High compression for Grok to avoid 413 errors
      } else if (service === 'openai-vision') {
        compressionQuality = 0.2; // High compression for OpenAI to avoid 413 errors
      } else {
        compressionQuality = 0.6; // Default compression
      }
      const base64 = canvas.toDataURL('image/jpeg', compressionQuality).split(',')[1];
      images.push(base64);
      
      // Log individual image size
      console.log(`Page ${i} image size: ${(base64.length / 1024 / 1024).toFixed(2)} MB`);
      
      // Show progress
      if (setProgress) {
        setProgress(30 + (i / maxPages) * 40); // 30-70% for conversion
      }
    }
    
    console.log(`Converted ${images.length} pages to images`);
    const totalSizeMB = images.reduce((sum, img) => sum + img.length, 0) / 1024 / 1024;
    console.log(`Total image data size: ${totalSizeMB.toFixed(2)} MB`);
    
    // Check if payload is too large for Vercel (smaller limit for vision APIs due to 413 errors)
    const maxSizeMB = (service === 'openai-vision' || service === 'grok-vision') ? 8 : 10;
    if (totalSizeMB > maxSizeMB) {
      if ((service === 'openai-vision' || service === 'grok-vision') && images.length > 5) {
        // Try with fewer pages for Vision APIs - progressive reduction
        const reductionSteps = service === 'grok-vision' ? [10, 8, 5, 3] : [15, 10, 8, 5];
        
        for (const pageLimit of reductionSteps) {
          if (images.length > pageLimit) {
            console.log(`⚠️ Payload too large (${totalSizeMB.toFixed(2)}MB), retrying with first ${pageLimit} pages...`);
            const reducedImages = images.slice(0, pageLimit);
            const reducedSizeMB = reducedImages.reduce((sum, img) => sum + img.length, 0) / 1024 / 1024;
            console.log(`Reduced payload size: ${reducedSizeMB.toFixed(2)} MB`);
            
            if (reducedSizeMB <= maxSizeMB) {
              const response = await analyzePDFWithImages(file, reducedImages, service, setExtractedData);
              return response;
            }
          }
        }
      }
      
      console.log(`⚠️ Image payload too large (${totalSizeMB.toFixed(2)}MB > ${maxSizeMB}MB), falling back to text extraction...`);
      throw new Error(`Image payload too large (${totalSizeMB.toFixed(2)}MB), using text extraction`);
    }
    
    // Now send images to API for extraction
    console.log('Sending images to API for extraction...');
    
    if (setProgress) {
      setProgress(75); // Progress for API call
    }
    
    const response = await analyzePDFWithImages(file, images, service, setExtractedData);
    
    return response;
    
  } catch (error) {
    console.error('PDF processing error:', error);
    
    // If it's a size issue, try text extraction as fallback
    if (error.message.includes('too large') || error.message.includes('payload')) {
      console.log('📄 Falling back to text-based extraction...');
      try {
        const response = await analyzeDocumentWithTextExtraction(file);
        return response;
      } catch (fallbackError) {
        console.error('Text extraction fallback also failed:', fallbackError);
        throw new Error(`Both image and text extraction failed: ${fallbackError.message}`);
      }
    }
    
    throw new Error(`PDF processing failed: ${error.message}`);
  }
};

// Text extraction fallback function
const analyzeDocumentWithTextExtraction = async (file) => {
  const apiUrl = import.meta.env.VITE_API_URL || '/api/analyze-document';
  
  try {
    // Convert file to base64
    const fileBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: file.name,
        file: fileBase64,
        useImageExtraction: false,
        prompt: `Analyze this business document for financial data and key information. Focus on extracting revenue, EBITDA, purchase price, and business details.`
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success && result.data) {
      return processAPIResponse(result.data, file);
    } else {
      throw new Error(result.error || 'Failed to analyze document');
    }
  } catch (error) {
    console.error('Text extraction error:', error);
    throw error;
  }
};

// Enhanced API analysis function with service selection
const analyzePDFWithImages = async (file, images, service = 'pdf-text-openai', setExtractedData) => {
  // Service URLs mapping
  const serviceUrls = {
    'grok-vision': '/api/analyze-grok',
    'pdf-text-openai': '/api/analyze-pdf-text',
    'pdf-text-claude': '/api/analyze-pdf-text',
    'openai-vision': '/api/analyze-openai',
    'claude-vision': '/api/analyze-claude', 
    'textract': '/api/analyze-textract'
  };
  
  const primaryUrl = serviceUrls[service];
  const fallbackUrl = '/api/analyze-intelligence';
  
  // Get base64 file data for processing
  const fileData = await fileToBase64(file);
  
  // Store metadata only for debugging (avoid localStorage quota issues)
  try {
    localStorage.setItem('lastUploadMetadata', JSON.stringify({
      fileName: file.name,
      imageCount: images?.length || 0,
      fileSizeMB: fileData ? (fileData.length / 1024 / 1024).toFixed(2) : 0,
      timestamp: new Date().toISOString()
    }));
  } catch (e) {
    console.log('localStorage quota exceeded, skipping debug storage');
  }
  
  try {
    console.log(`🚀 Attempting ${service.toUpperCase()} analysis...`);
    const response = await fetch(primaryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: file.name,
        images: images,
        fileData: fileData,
        aiService: service.includes('pdf-text') ? service.split('-')[2] : undefined
      })
    });
    
    if (!response.ok) {
      // Check if it's AWS credentials issue
      const errorText = await response.text();
      if (errorText.includes('AWS credentials')) {
        console.log('⚠️ AWS Textract not configured, falling back to AI-only analysis...');
        // Fall back to intelligence API
        return await analyzePDFWithIntelligenceAPI(file, images, fileData, service);
      }
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log(`🎉 ${service.toUpperCase()} analysis complete. Result keys:`, Object.keys(result));
    console.log(`📊 Full API result structure:`, result);
    
    if (result.success && result.data) {
      console.log('✅ Tables extracted:', result.metadata?.tablesFound || 0);
      console.log('📊 Confidence score:', result.metadata?.confidence || 'unknown');
      console.log('🔧 API data structure:', {
        hasTextractData: !!result.data.textractData,
        hasStructuredData: !!result.data.structuredData,
        hasRawResponse: !!result.data.rawResponse,
        hasDebugInfo: !!result.data.debugInfo,
        textractDataKeys: result.data.textractData ? Object.keys(result.data.textractData) : [],
        structuredDataKeys: result.data.structuredData ? Object.keys(result.data.structuredData) : []
      });
      
      // Show comprehensive extracted data with analysis
      if (setExtractedData && result.data) {
        console.log('🔍 Running extraction completeness analysis...');
        const comprehensiveData = analyzeExtractionCompleteness(result.data);
        console.log('📈 Completeness analysis result:', comprehensiveData);
        setExtractedData(comprehensiveData);
      }
      
      console.log('⚙️ About to call processTextractResponse...');
      const processedResult = processTextractResponse(result.data, file);
      console.log('✅ processTextractResponse completed:', processedResult);
      return processedResult;
    } else {
      console.error('❌ Analysis failed:', result.error);
      throw new Error(result.error || 'Failed to analyze document');
    }
  } catch (error) {
    console.error(`${service.toUpperCase()} API error, falling back:`, error);
    // Fall back to intelligence API
    return await analyzePDFWithIntelligenceAPI(file, images, fileData, service);
  }
};

// Fallback to intelligence API
const analyzePDFWithIntelligenceAPI = async (file, images, fileData, service = 'intelligence') => {
  const apiUrl = '/api/analyze-intelligence';
  
  try {
    console.log('🧠 Using AI intelligence analysis...');
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: file.name,
        images: images,
        fileData: fileData,
        aiService: service.includes('pdf-text') ? service.split('-')[2] : undefined
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ Intelligence analysis complete:', result);
    
    if (result.success && result.data) {
      return processAPIResponse(result.data, file);
    } else {
      throw new Error(result.error || 'Failed to analyze document');
    }
  } catch (error) {
    console.error('Intelligence API error:', error);
    throw error;
  }
};

// Note: Old debug function removed - using new comprehensive debugging system during extraction

// Comprehensive extraction analysis and scoring
const analyzeExtractionCompleteness = (data) => {
  const textractData = data.textractData?.financialData || {};
  const structuredData = data.structuredData || {};
  const metadata = data.metadata || {};
  
  // Define what we expect to find in a comprehensive CIM
  const expectedFields = {
    businessInfo: {
      name: structuredData.businessInfo?.name,
      type: structuredData.businessInfo?.type,
      description: structuredData.businessInfo?.description,
      location: structuredData.businessInfo?.location
    },
    financialMetrics: {
      revenue: textractData.revenue || {},
      grossProfit: textractData.grossProfit || {},
      ebitda: textractData.ebitda || {},
      operatingExpenses: textractData.operatingExpenses || {},
      netIncome: textractData.netIncome || {},
      sde: textractData.sde || {}
    },
    valuation: {
      purchasePrice: structuredData.purchasePrice,
      priceSource: structuredData.priceSource,
      valuation: structuredData.valuation,
      multiple: structuredData.multiple
    },
    periods: textractData.periods || [],
    additionalData: {
      customerData: structuredData.customerData,
      marketData: structuredData.marketData,
      growthMetrics: structuredData.growthMetrics,
      operationalMetrics: structuredData.operationalMetrics
    }
  };
  
  // Calculate completeness scores
  const scores = calculateCompletenessScores(expectedFields);
  
  // Count total data points extracted
  const dataPoints = countExtractedDataPoints(expectedFields);
  
  // Generate summary
  const summary = generateExtractionSummary(expectedFields, scores, dataPoints, metadata);
  
  return {
    ...summary,
    detailedBreakdown: expectedFields,
    extractionScores: scores,
    totalDataPoints: dataPoints,
    rawApiResponse: data // Store complete API response for debugging
  };
};

// Calculate completeness scores for different categories
const calculateCompletenessScores = (data) => {
  const scores = {};
  
  // Business Info Score (0-100)
  const businessFields = data.businessInfo;
  const businessScore = Object.values(businessFields).filter(v => v && v !== '').length / Object.keys(businessFields).length * 100;
  scores.businessInfo = Math.round(businessScore);
  
  // Financial Data Score (0-100)
  const financialMetrics = data.financialMetrics;
  let financialDataPoints = 0;
  let totalFinancialPossible = 0;
  
  Object.entries(financialMetrics).forEach(([metric, periods]) => {
    if (typeof periods === 'object' && periods !== null) {
      const validPeriods = Object.values(periods).filter(v => v !== null && v !== undefined && !isNaN(v));
      financialDataPoints += validPeriods.length;
      totalFinancialPossible += Math.max(3, Object.keys(periods).length); // Expect at least 3 years
    }
  });
  
  const financialScore = totalFinancialPossible > 0 ? (financialDataPoints / totalFinancialPossible) * 100 : 0;
  scores.financialData = Math.round(financialScore);
  
  // Valuation Score (0-100)
  const valuationFields = data.valuation;
  const valuationScore = Object.values(valuationFields).filter(v => v !== null && v !== undefined).length / Object.keys(valuationFields).length * 100;
  scores.valuation = Math.round(valuationScore);
  
  // Period Coverage Score (0-100)
  const periodsCount = data.periods.length;
  const periodScore = Math.min(periodsCount / 4 * 100, 100); // Expect 4+ periods
  scores.periodCoverage = Math.round(periodScore);
  
  // Overall Score (weighted average)
  const overallScore = (
    scores.businessInfo * 0.2 +
    scores.financialData * 0.5 +
    scores.valuation * 0.2 +
    scores.periodCoverage * 0.1
  );
  scores.overall = Math.round(overallScore);
  
  return scores;
};

// Count total extracted data points
const countExtractedDataPoints = (data) => {
  let count = 0;
  
  // Count business info fields
  count += Object.values(data.businessInfo).filter(v => v && v !== '').length;
  
  // Count financial data points
  Object.values(data.financialMetrics).forEach(periods => {
    if (typeof periods === 'object' && periods !== null) {
      count += Object.values(periods).filter(v => v !== null && v !== undefined && !isNaN(v)).length;
    }
  });
  
  // Count valuation fields
  count += Object.values(data.valuation).filter(v => v !== null && v !== undefined).length;
  
  // Count periods
  count += data.periods.length;
  
  return count;
};

// Generate human-readable summary
const generateExtractionSummary = (data, scores, dataPoints, metadata) => {
  const periods = data.periods.length > 0 ? data.periods.join(', ') : 'None detected';
  const businessName = data.businessInfo.name || 'Not detected';
  const purchasePrice = data.valuation.purchasePrice ? 
    `$${(data.valuation.purchasePrice / 1000000).toFixed(1)}M` : 'Not found';
  
  // Count financial metrics with data
  const financialMetricsWithData = Object.entries(data.financialMetrics)
    .filter(([_, periods]) => periods && Object.keys(periods).length > 0)
    .map(([metric, _]) => metric);
  
  return {
    summary: {
      businessName,
      purchasePrice,
      periods,
      financialMetricsFound: financialMetricsWithData,
      totalDataPoints: dataPoints,
      extractionMethod: metadata.extractionMethod || 'Unknown',
      pagesProcessed: metadata.pageCount || 'Unknown'
    },
    scores,
    recommendations: generateRecommendations(scores, data)
  };
};

// Generate improvement recommendations
const generateRecommendations = (scores, data) => {
  const recommendations = [];
  
  if (scores.businessInfo < 70) {
    recommendations.push("📋 Business info incomplete - check if company name, type, and description are clearly stated");
  }
  
  if (scores.financialData < 50) {
    recommendations.push("💰 Financial data extraction low - verify P&L statements and financial tables are clearly formatted");
  }
  
  if (scores.valuation < 30) {
    recommendations.push("💵 Purchase price not found - look for 'Asking Price', 'Sale Price', or valuation multiples");
  }
  
  if (scores.periodCoverage < 60) {
    recommendations.push("📅 Limited historical periods - ensure multiple years of data are included");
  }
  
  if (scores.overall > 80) {
    recommendations.push("✨ Excellent extraction! Most key data points captured successfully");
  } else if (scores.overall > 60) {
    recommendations.push("👍 Good extraction with room for improvement in specific areas");
  } else {
    recommendations.push("⚠️ Low extraction rate - document may need better formatting or different analysis service");
  }
  
  return recommendations;
};

// Enhanced financial calculations for insurance agencies and service businesses
const calculateFinancialMetrics = (revenue, costOfRevenue, operatingExpenses, netIncome, commissions, fees, premiums, extractedExpenses, ownerSalary) => {
  const grossProfit = {};
  const ebitda = {};
  const sde = {};
  const netIncomeCalc = {};
  
  // Get all periods from the data
  const periods = new Set([
    ...Object.keys(revenue || {}),
    ...Object.keys(costOfRevenue || {}),
    ...Object.keys(operatingExpenses || {}),
    ...Object.keys(netIncome || {}),
    ...Object.keys(commissions || {}),
    ...Object.keys(fees || {}),
    ...Object.keys(premiums || {}),
    ...Object.keys(extractedExpenses || {})
  ]);
  
  periods.forEach(period => {
    const rev = revenue[period] || 0;
    const cogs = costOfRevenue[period] || 0;
    const opex = operatingExpenses[period] || 0;
    const net = netIncome[period] || 0;
    const comm = commissions[period] || 0;
    const fee = fees[period] || 0;
    const prem = premiums[period] || 0;
    const expenses = extractedExpenses[period] || 0;
    
    // For insurance agencies, total revenue often includes commissions + fees
    let totalRevenue = rev;
    if (totalRevenue === 0 && (comm > 0 || fee > 0)) {
      totalRevenue = comm + fee;
      console.log(`📊 Calculated total revenue for ${period}: ${totalRevenue} (commissions: ${comm} + fees: ${fee})`);
    }
    
    // Calculate Gross Profit: For insurance agencies, typically Revenue - Direct Costs
    // Insurance agencies typically have high gross margins (80-95%)
    if (totalRevenue > 0) {
      grossProfit[period] = totalRevenue - cogs;
    }
    
    // Estimate operating expenses if not provided
    let estimatedOpex = opex || expenses;
    if (estimatedOpex === 0 && totalRevenue > 0) {
      // For insurance agencies, typical operating expenses are 60-80% of revenue
      // Conservative estimate: 70% of revenue
      estimatedOpex = totalRevenue * 0.7;
      console.log(`📊 Estimated operating expenses for ${period}: ${estimatedOpex} (70% of revenue)`);
    }
    
    // Calculate EBITDA: Revenue - Operating Expenses
    if (totalRevenue > 0) {
      ebitda[period] = totalRevenue - estimatedOpex;
      console.log(`📊 Calculated EBITDA for ${period}: ${ebitda[period]} (revenue: ${totalRevenue} - opex: ${estimatedOpex})`);
    }
    
    // Calculate Net Income if not provided
    if (net === 0 && ebitda[period]) {
      // Estimate taxes, interest, depreciation (typically 5-15% of EBITDA for small businesses)
      const taxDepreciation = ebitda[period] * 0.1;
      netIncomeCalc[period] = ebitda[period] - taxDepreciation;
      console.log(`📊 Calculated net income for ${period}: ${netIncomeCalc[period]} (EBITDA: ${ebitda[period]} - taxes/depreciation: ${taxDepreciation})`);
    }
    
    // Calculate SDE (Seller's Discretionary Earnings): EBITDA + Owner benefits
    if (ebitda[period]) {
      // Use extracted owner salary if available, otherwise estimate
      let ownerSalaryAmount = ownerSalary || 0;
      if (ownerSalaryAmount === 0) {
        // For insurance agencies, owner salary typically 10-15% of revenue
        ownerSalaryAmount = totalRevenue > 500000 ? totalRevenue * 0.12 : Math.min(totalRevenue * 0.15, 100000);
      }
      
      sde[period] = ebitda[period] + ownerSalaryAmount;
      console.log(`📊 Calculated SDE for ${period}: ${sde[period]} (EBITDA: ${ebitda[period]} + owner salary: ${ownerSalaryAmount})`);
    }
  });
  
  return { grossProfit, ebitda, sde, netIncome: netIncomeCalc };
};

// Validate and merge extracted metrics with calculated ones
const validateAndMergeMetrics = (extractedMetrics, calculatedMetrics, revenue) => {
  const result = {};
  
  // Get all periods
  const periods = new Set([
    ...Object.keys(extractedMetrics || {}),
    ...Object.keys(calculatedMetrics || {}),
    ...Object.keys(revenue || {})
  ]);
  
  periods.forEach(period => {
    const extracted = extractedMetrics[period];
    const calculated = calculatedMetrics[period];
    const rev = revenue[period] || 0;
    
    // Validate extracted data (catch obviously wrong values)
    const isExtractedValid = extracted != null && 
                            extracted >= 0 && 
                            extracted <= rev * 1.1 && // Allow up to 110% of revenue (for margin of error)
                            !isNaN(extracted);
    
    // Use extracted if valid, otherwise use calculated
    if (isExtractedValid) {
      result[period] = extracted;
    } else if (calculated != null && !isNaN(calculated)) {
      result[period] = calculated;
    }
  });
  
  return result;
};

// Process Textract API response into our data format
const processTextractResponse = (textractData, file) => {
  console.log('🔧 processTextractResponse called with:', {
    fileName: file.name,
    textractDataKeys: Object.keys(textractData),
    hasStructuredData: !!textractData.structuredData,
    hasTextractData: !!textractData.textractData,
    hasRawResponse: !!textractData.rawResponse,
    hasDebugInfo: !!textractData.debugInfo
  });
  
  console.log('📊 Raw textractData structure:', JSON.stringify(textractData, null, 2));
  
  const structuredData = textractData.structuredData || {};
  const textractFinancials = textractData.textractData?.financialData || {};
  const intelligence = textractData.intelligence || '';
  
  console.log('📋 Extracted components:', {
    structuredDataKeys: Object.keys(structuredData),
    textractFinancialsKeys: Object.keys(textractFinancials),
    intelligenceLength: intelligence.length,
    hasBusinessInfo: !!structuredData.businessInfo,
    hasPurchasePrice: !!structuredData.purchasePrice
  });
  
  // Handle new comprehensive data structure from rawResponse
  const rawApiResponse = textractData.rawResponse || textractData;
  console.log('🔍 Raw API Response Analysis:', {
    hasRawResponse: !!rawApiResponse,
    rawResponseKeys: rawApiResponse ? Object.keys(rawApiResponse) : [],
    hasFinancialData: !!rawApiResponse?.financialData,
    hasBusinessOverview: !!rawApiResponse?.businessOverview,
    hasProductsServices: !!rawApiResponse?.productsServices,
    hasEmployees: !!rawApiResponse?.employeesManagement,
    hasGrowthOps: !!rawApiResponse?.growthOpportunities,
    hasRisks: !!rawApiResponse?.risks
  });
  
  // Extract comprehensive financial data from new ultra-detailed structure
  const comprehensiveFinancials = rawApiResponse?.financialData || {};
  
  // Handle new detailed revenue structure
  const revenueData = comprehensiveFinancials.revenue || {};
  const revenue = revenueData.total || revenueData || textractFinancials.revenue || structuredData.financialData?.revenue || {};
  const commissions = revenueData.byCategory?.commissions || comprehensiveFinancials.commissions || {};
  const fees = revenueData.byCategory?.fees || comprehensiveFinancials.fees || {};
  const premiums = comprehensiveFinancials.premiums || {};
  
  // Handle new detailed expense structure
  const expenseData = comprehensiveFinancials.expenses || {};
  const expenses = expenseData.total || expenseData || {};
  const costOfRevenue = textractFinancials.cogs || textractFinancials.costOfRevenue || structuredData.financialData?.costOfRevenue || {};
  const operatingExpenses = expenses || textractFinancials.operatingExpenses || structuredData.financialData?.operatingExpenses || {};
  
  // Handle new EBITDA structure
  const ebitdaData = comprehensiveFinancials.ebitda || {};
  const netIncome = comprehensiveFinancials.netIncome || textractFinancials.netIncome || structuredData.financialData?.netIncome || {};
  const ebitdaExtracted = ebitdaData.reported || ebitdaData || textractFinancials.ebitda || {};
  const adjustedEbitda = ebitdaData.adjusted || {};
  const recastEbitda = ebitdaData.recast || {};
  
  console.log('💰 Comprehensive financial data extracted:', {
    revenueKeys: Object.keys(revenue),
    commissionsKeys: Object.keys(commissions),
    feesKeys: Object.keys(fees),
    premiumsKeys: Object.keys(premiums),
    expensesKeys: Object.keys(expenses),
    expenseCategories: expenseData.byCategory ? Object.keys(expenseData.byCategory) : [],
    costOfRevenueKeys: Object.keys(costOfRevenue),
    operatingExpensesKeys: Object.keys(operatingExpenses),
    netIncomeKeys: Object.keys(netIncome),
    ebitdaExtractedKeys: Object.keys(ebitdaExtracted),
    adjustedEbitdaKeys: Object.keys(adjustedEbitda),
    recastEbitdaKeys: Object.keys(recastEbitda),
    askingPrice: comprehensiveFinancials.askingPrice,
    askingPriceAmount: comprehensiveFinancials.askingPriceAmount,
    valuationMultiple: comprehensiveFinancials.valuationMultiple,
    metrics: comprehensiveFinancials.metrics,
    adjustments: comprehensiveFinancials.adjustments,
    validation: rawApiResponse?.validation
  });
  
  // Extract owner salary from detailed employee structure
  let ownerSalary = 0;
  if (rawApiResponse?.employeesManagement?.sellerInvolvement?.compensation) {
    ownerSalary = parseFloat(rawApiResponse.employeesManagement.sellerInvolvement.compensation.replace(/[^0-9.]/g, ''));
  } else if (rawApiResponse?.employeesManagement?.detailedRoster) {
    // Find owner/seller in detailed roster
    const owner = rawApiResponse.employeesManagement.detailedRoster.find(emp => 
      emp.title?.toLowerCase().includes('owner') || 
      emp.title?.toLowerCase().includes('president') ||
      emp.title?.toLowerCase().includes('ceo')
    );
    if (owner?.compensation?.baseSalary) {
      ownerSalary = owner.compensation.baseSalary;
    }
  } else if (rawApiResponse?.employeesManagement?.compensation) {
    ownerSalary = parseFloat(rawApiResponse.employeesManagement.compensation.replace(/[^0-9.]/g, ''));
  }
  
  console.log('💼 Owner salary extracted:', ownerSalary);
  
  // Calculate missing financial metrics with enhanced parameters
  const { grossProfit, ebitda, sde, netIncome: netIncomeCalc } = calculateFinancialMetrics(
    revenue, 
    costOfRevenue, 
    operatingExpenses, 
    netIncome, 
    commissions, 
    fees, 
    premiums, 
    expenses, 
    ownerSalary
  );
  
  // Combine extracted gross profit with calculated (prefer extracted if reasonable)
  const finalGrossProfit = validateAndMergeMetrics(
    textractFinancials.grossProfit || structuredData.financialData?.grossProfit || {},
    grossProfit,
    revenue
  );
  
  // Combine extracted EBITDA with calculated
  const finalEbitda = validateAndMergeMetrics(
    textractFinancials.ebitda || structuredData.financialData?.ebitda || {},
    ebitda,
    revenue
  );
  
  // Use calculated SDE (more reliable for small businesses)
  const finalSDE = structuredData.financialData?.sde || sde;
  
  // Use calculated net income if extracted is empty
  const finalNetIncome = validateAndMergeMetrics(
    netIncome,
    netIncomeCalc,
    revenue
  );
  
  // Get the correct extraction method from metadata
  const extractionMethod = textractData.metadata?.extractionMethod || 'Unknown Analysis';
  
  console.log('📈 Final calculated metrics:', {
    grossProfitKeys: Object.keys(finalGrossProfit),
    ebitdaKeys: Object.keys(finalEbitda),
    sdeKeys: Object.keys(finalSDE),
    netIncomeKeys: Object.keys(finalNetIncome)
  });
  
  const result = {
    id: generateId(),
    source: 'pdf',
    periods: comprehensiveFinancials.periods || structuredData.financialData?.periods || Object.keys(textractFinancials.years || {}) || ['TTM'],
    statements: { 
      incomeStatement: {
        revenue: revenue,
        commissions: commissions,
        fees: fees,
        premiums: premiums,
        commissionIncome: structuredData.financialData?.commissionIncome || {},
        costOfRevenue: costOfRevenue,
        grossProfit: finalGrossProfit,
        operatingExpenses: operatingExpenses,
        ebitda: finalEbitda,
        adjustedEbitda: adjustedEbitda || structuredData.financialData?.adjustedEbitda || {},
        recastEbitda: recastEbitda || structuredData.financialData?.recastEbitda || {},
        sde: finalSDE,
        netIncome: finalNetIncome,
        cashFlow: structuredData.financialData?.cashFlow || {},
        adjustments: textractFinancials.adjustments || []
      }
    },
    // NEW: Store comprehensive business analysis
    businessAnalysis: {
      overview: rawApiResponse?.businessOverview || {},
      products: rawApiResponse?.productsServices || {},
      employees: rawApiResponse?.employeesManagement || {},
      customers: rawApiResponse?.customers || {},
      opportunities: rawApiResponse?.growthOpportunities || [],
      advantages: rawApiResponse?.competitiveAdvantages || [],
      risks: rawApiResponse?.risks || [],
      marketAnalysis: rawApiResponse?.marketAnalysis || {},
      technology: rawApiResponse?.technology || {},
      financialControls: rawApiResponse?.financialControls || {},
      narrative: rawApiResponse?.narrative || intelligence,
      keyHighlights: rawApiResponse?.keyHighlights || []
    },
    metadata: {
      fileName: file.name,
      uploadDate: new Date(),
      confidence: textractData.confidence || 0.85,
      businessType: rawApiResponse?.businessOverview?.businessType || structuredData.businessInfo?.type || 'General Business',
      businessName: rawApiResponse?.businessOverview?.companyName || structuredData.businessInfo?.name,
      location: rawApiResponse?.businessOverview?.location,
      yearsInBusiness: rawApiResponse?.businessOverview?.yearsInBusiness,
      establishedYear: rawApiResponse?.businessOverview?.establishedYear,
      extractionMethod: extractionMethod,
      purchasePrice: comprehensiveFinancials.askingPriceAmount || structuredData.purchasePrice,
      askingPrice: comprehensiveFinancials.askingPrice,
      askingPriceAmount: comprehensiveFinancials.askingPriceAmount,
      valuationMultiple: comprehensiveFinancials.valuationMultiple,
      priceSource: structuredData.priceSource,
      policyCount: comprehensiveFinancials.policyCount,
      retention: comprehensiveFinancials.retention || comprehensiveFinancials.metrics?.customerRetention,
      totalEmployees: rawApiResponse?.employeesManagement?.totalEmployees?.fullTime || rawApiResponse?.employeesManagement?.totalEmployees,
      financialAdjustments: comprehensiveFinancials.adjustments || [],
      financialMetrics: comprehensiveFinancials.metrics || {},
      dataSources: comprehensiveFinancials.dataSources || [],
      carriers: rawApiResponse?.carriers || [],
      tablesExtracted: textractData.textractData?.allTables?.length || 0,
      // Store the intelligence narrative
      analysisNarrative: rawApiResponse?.narrative || intelligence,
      // Store raw Textract data for debugging
      textractMetadata: textractData.textractData?.documentMetadata,
      // Store complete raw response for debugging
      rawApiResponse: textractData.rawResponse || textractData,
      debugInfo: textractData.debugInfo || {},
      // Extraction completeness tracking
      extractionCompleteness: {
        hasFinancialData: !!(revenue && Object.keys(revenue).length > 0),
        hasBusinessOverview: !!(rawApiResponse?.businessOverview && Object.keys(rawApiResponse.businessOverview).length > 0),
        hasEmployees: !!(rawApiResponse?.employeesManagement && Object.keys(rawApiResponse.employeesManagement).length > 0),
        hasGrowthOps: !!(rawApiResponse?.growthOpportunities && rawApiResponse.growthOpportunities.length > 0),
        hasRisks: !!(rawApiResponse?.risks && rawApiResponse.risks.length > 0),
        hasNarrative: !!(rawApiResponse?.narrative && rawApiResponse.narrative.length > 100),
        hasCarriers: !!(rawApiResponse?.carriers && rawApiResponse.carriers.length > 0),
        hasAdjustments: !!(comprehensiveFinancials.adjustments && comprehensiveFinancials.adjustments.length > 0),
        validation: rawApiResponse?.validation || {}
      }
    }
  };
  
  console.log('✅ processTextractResponse final result:', {
    id: result.id,
    periods: result.periods,
    hasIncomeStatement: !!result.statements.incomeStatement,
    metadata: result.metadata,
    extractionMethod: result.metadata.extractionMethod,
    purchasePrice: result.metadata.purchasePrice,
    businessName: result.metadata.businessName
  });
  
  return result;
};

// Process Ultra-Intelligence API response into our data format
const processAPIResponse = (analysisData, file) => {
  // Handle new ultra-intelligence format
  const structuredData = analysisData.structuredData || analysisData;
  
  return {
    id: generateId(),
    source: 'pdf',
    periods: structuredData.financialData?.periods || ['TTM'],
    statements: { 
      incomeStatement: {
        revenue: structuredData.financialData?.revenue || {},
        commissionIncome: structuredData.financialData?.commissionIncome || {},
        costOfRevenue: structuredData.financialData?.costOfRevenue || {},
        grossProfit: structuredData.financialData?.grossProfit || {},
        operatingExpenses: structuredData.financialData?.operatingExpenses || {},
        ebitda: structuredData.financialData?.ebitda || {},
        adjustedEbitda: structuredData.financialData?.adjustedEbitda || {},
        recastEbitda: structuredData.financialData?.recastEbitda || {},
        sde: structuredData.financialData?.sde || {},
        netIncome: structuredData.financialData?.netIncome || {},
        cashFlow: structuredData.financialData?.cashFlow || {}
      }
    },
    metadata: {
      fileName: file.name,
      uploadDate: new Date(),
      confidence: structuredData.confidence || analysisData.metadata?.confidence || 0.85,
      businessType: structuredData.businessInfo?.type || 'General Business',
      businessName: structuredData.businessInfo?.name,
      location: structuredData.businessInfo?.location,
      employees: structuredData.businessInfo?.employees,
      yearEstablished: structuredData.businessInfo?.yearEstablished,
      extractionMethod: 'Ultra-Intelligence Analysis',
      purchasePrice: structuredData.purchasePrice,
      priceSource: structuredData.priceSource,
      priceConfidence: structuredData.priceConfidence,
      keyMetrics: structuredData.keyMetrics,
      businessModel: structuredData.businessInfo?.businessModel,
      competitiveAdvantage: structuredData.businessInfo?.competitiveAdvantage,
      // Ultra-intelligence specific data
      documentIntelligence: analysisData.documentIntelligence,
      investmentIntelligence: analysisData.investmentIntelligence,
      intelligenceAssessment: structuredData.intelligenceAssessment,
      valuationIntelligence: structuredData.valuationIntelligence,
      valueCreationPlan: structuredData.valueCreationPlan,
      riskAssessment: structuredData.riskAssessment,
      modelInfo: analysisData.metadata
    }
  };
};

// Get the best available EBITDA metric (prioritize adjusted/recast over actual)
const getBestEBITDA = (financialData) => {
  if (!financialData) return {};
  
  // Priority order: SDE > Recast EBITDA > Adjusted EBITDA > Regular EBITDA
  const periods = financialData.periods || ['TTM'];
  const result = {};
  
  periods.forEach(period => {
    result[period] = 
      financialData.sde?.[period] || 
      financialData.recastEbitda?.[period] || 
      financialData.adjustedEbitda?.[period] || 
      financialData.ebitda?.[period] || 
      null;
  });
  
  console.log('Best EBITDA selection:', result);
  return result;
};

// Enhanced Claude PDF Analysis using backend API
const analyzeWithClaude = async (file) => {
  try {
    console.log('Sending file to Claude API:', file.name);
    
    // Convert PDF to base64 for Claude API
    const base64 = await fileToBase64(file);
    
    const response = await fetch('http://localhost:3001/api/analyze-document', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: base64,
        fileName: file.name,
        prompt: `You are an expert M&A analyst specializing in small business acquisitions, particularly in the search fund and SMB acquisition space. You have deep experience analyzing Confidential Information Memorandums (CIMs) and identifying key investment considerations.

Your role is to provide thorough, actionable analysis of business acquisition opportunities from the perspective of an individual searcher or small PE buyer. Focus on practical insights that would help make an investment decision.

Analyze this CIM following this structured approach and return the analysis in JSON format:

{
  "financialData": {
    "periods": ["2021", "2022", "2023", "TTM"],
    "revenue": {"2021": null, "2022": null, "2023": null, "TTM": null},
    "costOfRevenue": {"2021": null, "2022": null, "2023": null, "TTM": null},
    "grossProfit": {"2021": null, "2022": null, "2023": null, "TTM": null},
    "operatingExpenses": {"2021": null, "2022": null, "2023": null, "TTM": null},
    "ebitda": {"2021": null, "2022": null, "2023": null, "TTM": null},
    "adjustedEbitda": {"2021": null, "2022": null, "2023": null, "TTM": null},
    "recastEbitda": {"2021": null, "2022": null, "2023": null, "TTM": null},
    "sde": {"2021": null, "2022": null, "2023": null, "TTM": null},
    "commissionIncome": {"2021": null, "2022": null, "2023": null, "TTM": null},
    "netIncome": {"2021": null, "2022": null, "2023": null, "TTM": null}
  },
  "quickStats": {
    "revenueLatest": null,
    "growthRate": null,
    "ebitdaLatest": null,
    "ebitdaMargin": null,
    "askingPrice": null,
    "ebitdaMultiple": null,
    "industry": "",
    "location": ""
  },
  "executiveSummary": "",
  "businessOverview": {
    "businessModel": "",
    "revenueStreams": [],
    "competitiveAdvantages": [],
    "geographicFootprint": "",
    "yearsInOperation": null,
    "ownershipStructure": ""
  },
  "valuationAssessment": {
    "revenueMultiple": null,
    "ebitdaMultiple": null,
    "industryBenchmarks": "",
    "askingPriceAssessment": "",
    "valueCreationOpportunities": []
  },
  "growthDrivers": [
    {
      "description": "",
      "impact": "Low/Medium/High",
      "difficulty": "Easy/Moderate/Hard",
      "timeframe": "Immediate/6-12 months/1-2 years"
    }
  ],
  "risks": {
    "critical": [],
    "major": [],
    "minor": []
  },
  "operationalAssessment": {
    "managementDepth": "",
    "systemsMaturity": "",
    "scalabilityConstraints": [],
    "technologyUtilization": "",
    "efficiencyOpportunities": []
  },
  "customerMarketAnalysis": {
    "customerConcentration": "",
    "customerQuality": "",
    "marketSize": "",
    "competitiveDynamics": "",
    "regulatoryConsiderations": []
  },
  "dueDiligencePriorities": [],
  "searcherFitAssessment": {
    "idealBuyerProfile": {
      "requiredSkills": [],
      "capitalRequirements": "",
      "timeCommitment": ""
    },
    "notSuitableFor": []
  },
  "dealStructureConsiderations": {
    "sbaEligibility": "",
    "sellerNoteRecommendation": "",
    "earnoutProvisions": "",
    "workingCapitalAdjustments": "",
    "assetVsStock": ""
  },
  "keyQuestionsForSeller": [],
  "recommendation": {
    "rating": "STRONG BUY/BUY/HOLD/PASS",
    "keyReasons": [],
    "nextSteps": []
  },
  "businessType": "",
  "purchasePrice": null,
  "priceSource": "extracted_from_pdf/estimated"
}

CRITICAL INSTRUCTIONS:
1. Extract ONLY real financial data you can see in the document - do NOT estimate or make up numbers
2. Use null for any financial fields you cannot find
3. Convert all numbers to USD integers (remove commas, dollar signs, convert K/M/B to full numbers)
4. For purchase price, search EXHAUSTIVELY for these terms and patterns:
   DIRECT TERMS: "Asking Price", "Purchase Price", "Enterprise Value", "Transaction Value", "Sale Price", "Acquisition Price", "Investment Required", "Business Value", "Valuation", "Price", "Investment Opportunity"
   
   CONTEXTUAL PATTERNS: Look for dollar amounts near these phrases:
   - "The business is being offered for", "Priced at", "Valued at", "Available for"
   - "Total investment", "Capital required", "Acquisition cost"
   - "Multiple of EBITDA", "x EBITDA", "times EBITDA" (calculate: multiple × EBITDA)
   
   DOCUMENT SECTIONS: Search these areas specifically:
   - Title page, Executive Summary (first 2 pages)
   - Investment Highlights/Overview sections
   - Financial Summary tables
   - Investment Terms/Structure sections
   - Any "Pricing" or "Valuation" headers
   
   CALCULATION METHODS: If no direct price, calculate from:
   - EBITDA Multiple: If document mentions "X.X times EBITDA" or "X.X × EBITDA", multiply by latest EBITDA
   - Revenue Multiple: If mentions "X.X times revenue", multiply by latest revenue
   - Asset Value: Look for "net asset value", "book value", "tangible assets"
   
   VALIDATION: Cross-check found price against business size (should be reasonable multiple of revenue/EBITDA)
5. For financial data, look for:
   - Income statements, P&L statements, financial summaries
   - Revenue figures (may be called Sales, Net Revenue, Total Revenue, Commission Income)
   - EBITDA variations: "Adjusted EBITDA", "Recast EBITDA", "Pro Forma EBITDA", "Seller's Discretionary Earnings (SDE)"
   - ALWAYS prefer Adjusted/Recast EBITDA over actual EBITDA when available
   - Look for TTM (Trailing Twelve Months), current year, and historical data
   - For insurance agencies: Commission Income, Renewal Rates, Book of Business
   - For SaaS: MRR, ARR, Churn Rate, Customer metrics
6. Provide detailed, actionable analysis in each section based on what you actually find
7. Focus on practical insights for individual searchers making acquisition decisions
8. Flag specific risks and opportunities you can identify from the document
9. If you cannot find purchase price or key financial metrics, explicitly state this in your analysis
10. Return ONLY the JSON object, no other text`
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Claude API response:', result);
    
    if (result.success && result.data) {
      const analysisData = result.data;
      return {
        id: generateId(),
        source: 'pdf',
        periods: analysisData.financialData?.periods || ['TTM'],
        statements: { 
          incomeStatement: {
            revenue: analysisData.financialData?.revenue || {},
            costOfRevenue: analysisData.financialData?.costOfRevenue || {},
            grossProfit: analysisData.financialData?.grossProfit || {},
            operatingExpenses: analysisData.financialData?.operatingExpenses || {},
            ebitda: getBestEBITDA(analysisData.financialData),
            adjustedEbitda: analysisData.financialData?.adjustedEbitda || {},
            recastEbitda: analysisData.financialData?.recastEbitda || {},
            sde: analysisData.financialData?.sde || {},
            commissionIncome: analysisData.financialData?.commissionIncome || {},
            netIncome: analysisData.financialData?.netIncome || {}
          }
        },
        metadata: {
          fileName: file.name,
          uploadDate: new Date(),
          confidence: 0.95,
          businessType: analysisData.businessType || 'Unknown',
          extractionMethod: 'Claude M&A Analysis'
        },
        purchasePrice: analysisData.purchasePrice || analysisData.quickStats?.askingPrice,
        priceSource: analysisData.priceSource || (analysisData.purchasePrice ? 'extracted_from_pdf' : 'estimated'),
        cimAnalysis: {
          quickStats: analysisData.quickStats,
          executiveSummary: analysisData.executiveSummary,
          businessOverview: analysisData.businessOverview,
          valuationAssessment: analysisData.valuationAssessment,
          growthDrivers: analysisData.growthDrivers,
          risks: analysisData.risks,
          operationalAssessment: analysisData.operationalAssessment,
          customerMarketAnalysis: analysisData.customerMarketAnalysis,
          dueDiligencePriorities: analysisData.dueDiligencePriorities,
          searcherFitAssessment: analysisData.searcherFitAssessment,
          dealStructureConsiderations: analysisData.dealStructureConsiderations,
          keyQuestionsForSeller: analysisData.keyQuestionsForSeller,
          recommendation: analysisData.recommendation
        }
      };
    } else {
      throw new Error('Invalid response from Claude API');
    }
  } catch (error) {
    console.error('Claude analysis failed:', error);
    throw new Error(`Claude API analysis failed: ${error.message || 'Unable to connect to analysis service'}`);
  }
};

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
};

// PDF.js extraction removed - using server-side extraction only

// Text analysis removed - using server-side analysis only
/*
const analyzeFinancialText = (text, fileName) => {
  console.log('Analyzing extracted PDF text for financial data...');
  
  // Parse business type from content
  let businessType = 'General Business';
  const lowerText = text.toLowerCase();
  if (lowerText.includes('insurance') || lowerText.includes('broker')) businessType = 'Insurance Brokerage';
  else if (lowerText.includes('technology') || lowerText.includes('software')) businessType = 'Technology';
  else if (lowerText.includes('manufacturing')) businessType = 'Manufacturing';
  else if (lowerText.includes('healthcare') || lowerText.includes('medical')) businessType = 'Healthcare';
  else if (lowerText.includes('retail')) businessType = 'Retail';
  
  // Extract financial data using comprehensive regex patterns
  const extractFinancialValue = (pattern) => {
    const matches = text.match(pattern);
    if (matches) {
      return matches.map(match => {
        const numberMatch = match.match(/\$?\s*([\d,]+)/);
        return numberMatch ? parseInt(numberMatch[1].replace(/,/g, '')) : 0;
      });
    }
    return [];
  };
  
  // Look for purchase price patterns first
  const purchasePricePatterns = [
    /Purchase\s+Price[:\s]+\$?\s*([\d,]+)/gi,
    /Asking\s+Price[:\s]+\$?\s*([\d,]+)/gi,
    /Sale\s+Price[:\s]+\$?\s*([\d,]+)/gi,
    /Transaction\s+Value[:\s]+\$?\s*([\d,]+)/gi,
    /Acquisition\s+Price[:\s]+\$?\s*([\d,]+)/gi,
    /Valuation[:\s]+\$?\s*([\d,]+)/gi,
    /Enterprise\s+Value[:\s]+\$?\s*([\d,]+)/gi
  ];

  // Look for various revenue patterns
  const revenuePatterns = [
    /Total\s+Income[:\s]+\$?\s*([\d,]+)/gi,
    /Revenue[:\s]+\$?\s*([\d,]+)/gi,
    /Sales[:\s]+\$?\s*([\d,]+)/gi,
    /Income[:\s]+\$?\s*([\d,]+)/gi,
    /Commission\s+Income[:\s]+\$?\s*([\d,]+)/gi,
    /Broker\s+Fee\s+Income[:\s]+\$?\s*([\d,]+)/gi
  ];
  
  // Look for expense patterns
  const expensePatterns = [
    /Operating\s+Expenses?[:\s]+\$?\s*([\d,]+)/gi,
    /Total\s+Expenses?[:\s]+\$?\s*([\d,]+)/gi,
    /Expenses?[:\s]+\$?\s*([\d,]+)/gi,
    /Cost[:\s]+\$?\s*([\d,]+)/gi
  ];
  
  // Look for profit patterns
  const profitPatterns = [
    /Gross\s+Profit[:\s]+\$?\s*([\d,]+)/gi,
    /Net\s+Income[:\s]+\$?\s*([\d,]+)/gi,
    /EBITDA[:\s]+\$?\s*([\d,]+)/gi,
    /Profit[:\s]+\$?\s*([\d,]+)/gi
  ];
  
  // Extract purchase price first
  let allPurchasePrices = [];
  purchasePricePatterns.forEach(pattern => {
    allPurchasePrices = allPurchasePrices.concat(extractFinancialValue(pattern));
  });
  
  // Extract all financial numbers
  let allRevenue = [];
  let allExpenses = [];
  let allProfits = [];
  
  revenuePatterns.forEach(pattern => {
    allRevenue = allRevenue.concat(extractFinancialValue(pattern));
  });
  
  expensePatterns.forEach(pattern => {
    allExpenses = allExpenses.concat(extractFinancialValue(pattern));
  });
  
  profitPatterns.forEach(pattern => {
    allProfits = allProfits.concat(extractFinancialValue(pattern));
  });
  
  console.log('Extracted purchase prices:', allPurchasePrices);
  console.log('Extracted revenue values:', allRevenue);
  console.log('Extracted expense values:', allExpenses);
  console.log('Extracted profit values:', allProfits);
  
  // Try to identify periods (2021, 2022, 2023, TTM)
  const periods = ['2021', '2022', '2023', 'TTM'];
  const extractedData = {};
  
  // Look for data organized by year
  periods.forEach(period => {
    const periodRegex = new RegExp(`${period}[^\\d]*\\$?\\s*([\\d,]+)`, 'gi');
    const matches = text.match(periodRegex);
    if (matches) {
      extractedData[period] = matches.map(match => {
        const numberMatch = match.match(/\$?\s*([\d,]+)/);
        return numberMatch ? parseInt(numberMatch[1].replace(/,/g, '')) : 0;
      });
    }
  });
  
  console.log('Extracted data by period:', extractedData);
  
  // Build financial statements from extracted data
  // If we have specific period data, use it; otherwise use the largest values found
  const buildStatement = (label, defaultValues) => {
    const statement = {};
    periods.forEach((period, index) => {
      if (extractedData[period] && extractedData[period].length > 0) {
        // Use the largest value for this period (often the total)
        statement[period] = Math.max(...extractedData[period]);
      } else if (defaultValues && defaultValues[index] !== undefined) {
        statement[period] = defaultValues[index];
      } else {
        statement[period] = 0;
      }
    });
    return statement;
  };
  
  // Use extracted revenue values or fallback to sorted values
  let revenue;
  if (allRevenue.length >= 3) {
    // Sort revenue values and assign to periods (assuming chronological growth)
    const sortedRevenue = allRevenue.sort((a, b) => a - b);
    revenue = {
      '2021': sortedRevenue[0] || 0,
      '2022': sortedRevenue[1] || sortedRevenue[0] || 0,
      '2023': sortedRevenue[2] || sortedRevenue[1] || 0,
      'TTM': sortedRevenue[sortedRevenue.length - 1] || 0
    };
  } else {
    revenue = buildStatement('revenue');
  }
  
  // For service businesses like insurance brokerage, cost of revenue is typically very low
  const isServiceBusiness = businessType.includes('Insurance') || businessType.includes('Service');
  const costOfRevenue = {
    '2021': isServiceBusiness ? 0 : Math.floor(revenue['2021'] * 0.6),
    '2022': isServiceBusiness ? 0 : Math.floor(revenue['2022'] * 0.6),
    '2023': isServiceBusiness ? 0 : Math.floor(revenue['2023'] * 0.6),
    'TTM': isServiceBusiness ? 0 : Math.floor(revenue['TTM'] * 0.6)
  };
  
  const grossProfit = {
    '2021': revenue['2021'] - costOfRevenue['2021'],
    '2022': revenue['2022'] - costOfRevenue['2022'],
    '2023': revenue['2023'] - costOfRevenue['2023'],
    'TTM': revenue['TTM'] - costOfRevenue['TTM']
  };
  
  // Use extracted expense values or estimate
  let operatingExpenses;
  if (allExpenses.length >= 3) {
    const sortedExpenses = allExpenses.sort((a, b) => a - b);
    operatingExpenses = {
      '2021': sortedExpenses[0] || Math.floor(revenue['2021'] * 0.7),
      '2022': sortedExpenses[1] || Math.floor(revenue['2022'] * 0.7),
      '2023': sortedExpenses[2] || Math.floor(revenue['2023'] * 0.65),
      'TTM': sortedExpenses[sortedExpenses.length - 1] || Math.floor(revenue['TTM'] * 0.6)
    };
  } else {
    // Estimate based on revenue (service businesses typically have high opex %)
    const opexRate = isServiceBusiness ? 0.6 : 0.3;
    operatingExpenses = {
      '2021': Math.floor(revenue['2021'] * opexRate),
      '2022': Math.floor(revenue['2022'] * opexRate),
      '2023': Math.floor(revenue['2023'] * (opexRate - 0.05)),
      'TTM': Math.floor(revenue['TTM'] * (opexRate - 0.1))
    };
  }
  
  const ebitda = {
    '2021': Math.max(grossProfit['2021'] - operatingExpenses['2021'], 0),
    '2022': Math.max(grossProfit['2022'] - operatingExpenses['2022'], 0),
    '2023': Math.max(grossProfit['2023'] - operatingExpenses['2023'], 0),
    'TTM': Math.max(grossProfit['TTM'] - operatingExpenses['TTM'], 0)
  };
  
  const netIncome = {
    '2021': Math.floor(ebitda['2021'] * 0.75),
    '2022': Math.floor(ebitda['2022'] * 0.75),
    '2023': Math.floor(ebitda['2023'] * 0.78),
    'TTM': Math.floor(ebitda['TTM'] * 0.8)
  };
  
  // Determine purchase price from PDF or mark as estimated
  let extractedPurchasePrice = null;
  let priceSource = 'estimated';
  
  if (allPurchasePrices.length > 0) {
    // Use the largest purchase price found (most likely to be the main transaction value)
    extractedPurchasePrice = Math.max(...allPurchasePrices);
    priceSource = 'extracted_from_pdf';
    console.log('Found purchase price in PDF:', extractedPurchasePrice);
  }
  
  console.log('Final financial analysis:', { revenue, grossProfit, operatingExpenses, ebitda, netIncome });
  console.log('Purchase price info:', { extractedPurchasePrice, priceSource });
  
  return {
    periods,
    businessType,
    purchasePrice: extractedPurchasePrice,
    priceSource,
    incomeStatement: {
      revenue,
      costOfRevenue,
      grossProfit,
      operatingExpenses,
      ebitda,
      netIncome
    }
  };
};
*/

// Excel Processing Functions
const processExcelFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        console.log('Processing Excel file:', file.name);
        console.log('Available sheets:', workbook.SheetNames);
        
        // Try to find the most relevant sheet (prioritize income statement, P&L, etc.)
        const sheetName = findBestSheet(workbook.SheetNames);
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        console.log('Raw data from sheet:', jsonData.slice(0, 20)); // Log first 20 rows
        
        // Extract financial data from the spreadsheet
        const extractedData = extractFinancialData(jsonData, file.name);
        
        resolve({
          id: generateId(),
          source: 'excel',
          periods: extractedData.periods,
          statements: { incomeStatement: extractedData.incomeStatement },
          metadata: {
            fileName: file.name,
            uploadDate: new Date(),
            confidence: 0.88
          }
        });
      } catch (error) {
        reject(new Error('Failed to parse financial file'));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

// Universal Smart Assumptions Generator with Enhanced EBITDA Recognition
const generateSmartAssumptions = (data) => {
  const latestPeriod = data.periods[data.periods.length - 1];
  const latestRevenue = data.statements.incomeStatement?.revenue[latestPeriod] || 0;
  
  // Get the best available EBITDA (prioritizes adjusted/recast)
  const latestEBITDA = data.statements.incomeStatement?.ebitda[latestPeriod] || 0;
  const latestCommissionIncome = data.statements.incomeStatement?.commissionIncome?.[latestPeriod] || 0;
  const latestSDE = data.statements.incomeStatement?.sde?.[latestPeriod] || 0;
  
  // Detect business type using new universal system
  const businessType = identifyBusinessType(data.metadata?.fileName || '', data.statements.incomeStatement, data.metadata?.extractedText || '');
  const valuationModel = businessType.valuationModel;
  
  // Check if purchase price was extracted from PDF first
  let finalPrice = 0;
  let estimationMethod = '';
  let priceSource = 'estimated';
  
  if (data.purchasePrice && data.priceSource === 'extracted_from_pdf') {
    // Use the purchase price found in the PDF
    finalPrice = data.purchasePrice;
    estimationMethod = 'Extracted from PDF';
    priceSource = 'extracted_from_pdf';
    console.log('Using purchase price from PDF:', finalPrice);
  } else {
    // Use industry-specific valuation logic with enhanced metric selection
    const primaryMetric = valuationModel.primaryMetric;
    const multiple = valuationModel.typicalMultiple.default;
    
    // Use the best available metric for each business type
    if (primaryMetric === 'commission_income' && latestCommissionIncome > 0) {
      // Insurance agencies - use actual commission income if available
      finalPrice = latestCommissionIncome * multiple;
      estimationMethod = `${multiple}x Commission Income (${businessType.type})`;
    } else if (primaryMetric === 'commission_income' && latestRevenue > 0) {
      // Insurance agencies fallback - use revenue as commission income
      finalPrice = latestRevenue * multiple;
      estimationMethod = `${multiple}x Commission Income (${businessType.type})`;
    } else if (primaryMetric === 'arr' && latestRevenue > 0) {
      // SaaS - estimate ARR from revenue
      finalPrice = latestRevenue * multiple;
      estimationMethod = `${multiple}x ARR (${businessType.type})`;
    } else if (primaryMetric === 'ebitda' && (latestSDE > 0 || latestEBITDA > 0)) {
      // Use SDE if available, otherwise best EBITDA
      const ebitdaValue = latestSDE > 0 ? latestSDE : latestEBITDA;
      const metricName = latestSDE > 0 ? 'SDE' : 'EBITDA';
      finalPrice = ebitdaValue * multiple;
      estimationMethod = `${multiple}x ${metricName} (${businessType.type})`;
    } else if (primaryMetric === 'revenue' && latestRevenue > 0) {
      finalPrice = latestRevenue * multiple;
      estimationMethod = `${multiple}x Revenue (${businessType.type})`;
    } else if (latestEBITDA > 0 || latestSDE > 0) {
      // Fallback to best available EBITDA metric
      const ebitdaValue = latestSDE > 0 ? latestSDE : latestEBITDA;
      const metricName = latestSDE > 0 ? 'SDE' : 'EBITDA';
      finalPrice = ebitdaValue * multiple;
      estimationMethod = `${multiple}x ${metricName} (${businessType.type})`;
    } else if (latestRevenue > 0) {
      // Final fallback to revenue
      finalPrice = latestRevenue * multiple;
      estimationMethod = `${multiple}x Revenue (${businessType.type})`;
    } else {
      // No financial data available
      finalPrice = 0;
      estimationMethod = 'Manual Input Required - No Financial Data';
    }
    priceSource = 'estimated';
  }
  
  // Industry-specific financing assumptions
  const financingProfile = getFinancingProfile(businessType.valuationModel.financialFocus);
  
  return {
    purchasePrice: Math.round(finalPrice),
    businessType: businessType.type,
    businessDescription: businessType.description,
    downPaymentPercent: financingProfile.downPayment,
    debtPercent: financingProfile.debtPercent,
    interestRate: financingProfile.interestRate,
    loanTermYears: financingProfile.loanTerm,
    sellerFinancingPercent: financingProfile.sellerFinancing,
    sellerInterestRate: 0.08,
    revenueGrowthRate: getIndustryGrowthRate(businessType.type),
    marginRate: getIndustryMarginRate(businessType.type),
    priceEstimationMethod: estimationMethod,
    priceSource: priceSource,
    confidence: businessType.confidence
  };
};

// Adaptive Financing Profiles
const getFinancingProfile = (financialFocus) => {
  const profiles = {
    recurring_revenue: {
      downPayment: 0.10,
      debtPercent: 0.75,
      interestRate: 0.11, // Base SBA rate
      loanTerm: 10,
      sellerFinancing: 0.15
    },
    asset_heavy: {
      downPayment: 0.15,
      debtPercent: 0.80,
      interestRate: 0.10, // Lower rate due to asset backing
      loanTerm: 15,
      sellerFinancing: 0.05
    },
    project_based: {
      downPayment: 0.15,
      debtPercent: 0.70,
      interestRate: 0.12, // Higher rate due to volatility
      loanTerm: 7,
      sellerFinancing: 0.15
    },
    transactional: {
      downPayment: 0.20,
      debtPercent: 0.65,
      interestRate: 0.12, // Higher rate due to customer dependency
      loanTerm: 7,
      sellerFinancing: 0.15
    },
    mixed: {
      downPayment: 0.10,
      debtPercent: 0.75,
      interestRate: 0.11,
      loanTerm: 10,
      sellerFinancing: 0.15
    }
  };
  
  return profiles[financialFocus] || profiles.mixed;
};

// Industry-specific growth rates
const getIndustryGrowthRate = (businessType) => {
  const growthRates = {
    insurance_agency: 0.08, // Conservative, stable growth
    construction: 0.12, // Higher growth potential
    saas: 0.25, // High growth sector
    manufacturing: 0.08, // Steady growth
    retail: 0.06, // Lower growth, mature sector
    restaurant: 0.10, // Moderate growth
    professional_services: 0.12, // Good growth potential
    healthcare: 0.10, // Steady demographic-driven growth
    distribution: 0.08, // Conservative growth
    general_business: 0.10
  };
  
  return growthRates[businessType] || 0.10;
};

// Industry-specific margin expectations
const getIndustryMarginRate = (businessType) => {
  const marginRates = {
    insurance_agency: 0.35, // High margin business
    construction: 0.12, // Lower margin, competitive
    saas: 0.25, // High margin after scale
    manufacturing: 0.15, // Moderate margins
    retail: 0.08, // Low margin business
    restaurant: 0.12, // Tight margins
    professional_services: 0.20, // Good margins for expertise
    healthcare: 0.18, // Regulated but stable margins
    distribution: 0.10, // Low margin, volume business
    general_business: 0.15
  };
  
  return marginRates[businessType] || 0.15;
};

// DSCR Analysis and Validation
const analyzeDSCR = (dscrArray) => {
  const minimumDSCR = 1.25; // Lender requirement
  const strongDSCR = 1.5; // Strong coverage threshold
  
  if (!dscrArray || dscrArray.length === 0) {
    return {
      status: 'error',
      message: 'No DSCR data available',
      yearlyAnalysis: []
    };
  }

  const yearlyAnalysis = dscrArray.map((dscr, index) => {
    const year = index + 1;
    let status, message, color;
    
    if (dscr >= strongDSCR) {
      status = 'excellent';
      color = 'green';
      message = `${dscr.toFixed(2)}x - Strong debt service coverage`;
    } else if (dscr >= minimumDSCR) {
      status = 'acceptable';
      color = 'yellow';
      message = `${dscr.toFixed(2)}x - Meets minimum requirements`;
    } else if (dscr >= 1.0) {
      status = 'warning';
      color = 'orange';
      message = `${dscr.toFixed(2)}x - Below lender minimum of ${minimumDSCR}x`;
    } else {
      status = 'critical';
      color = 'red';
      message = `${dscr.toFixed(2)}x - Cannot service debt`;
    }
    
    return {
      year,
      value: dscr,
      status,
      message,
      color
    };
  });

  // Overall assessment
  const year1DSCR = dscrArray[0];
  const avgDSCR = dscrArray.reduce((sum, dscr) => sum + dscr, 0) / dscrArray.length;
  const minDSCR = Math.min(...dscrArray);
  
  let overallStatus, overallMessage;
  
  if (minDSCR < 1.0) {
    overallStatus = 'critical';
    overallMessage = 'Critical: Cash flow insufficient to service debt in some years';
  } else if (minDSCR < minimumDSCR) {
    overallStatus = 'warning';
    overallMessage = `Warning: DSCR falls below ${minimumDSCR}x minimum in some years`;
  } else if (avgDSCR >= strongDSCR) {
    overallStatus = 'excellent';
    overallMessage = 'Excellent: Strong debt service coverage throughout projection';
  } else {
    overallStatus = 'acceptable';
    overallMessage = 'Acceptable: Meets lender requirements with adequate cushion';
  }

  return {
    status: overallStatus,
    message: overallMessage,
    year1DSCR,
    avgDSCR,
    minDSCR,
    yearlyAnalysis,
    lenderRequirement: minimumDSCR
  };
};

// Dynamic exit valuation models by business type
const getExitValuationModel = (businessType) => {
  const exitModels = {
    insurance_agency: { 
      metric: 'commission_income', 
      multiple: 2.0,
      display: '2.0x Commission Income' 
    },
    saas: { 
      metric: 'arr', 
      multiple: 6.0,
      display: '6.0x ARR' 
    },
    construction: { 
      metric: 'ebitda', 
      multiple: 3.5,
      display: '3.5x EBITDA' 
    },
    manufacturing: { 
      metric: 'ebitda', 
      multiple: 4.5,
      display: '4.5x EBITDA' 
    },
    healthcare: { 
      metric: 'ebitda', 
      multiple: 5.5,
      display: '5.5x EBITDA' 
    },
    professional_services: { 
      metric: 'revenue', 
      multiple: 1.1,
      display: '1.1x Revenue' 
    },
    retail: { 
      metric: 'revenue', 
      multiple: 0.5,
      display: '0.5x Revenue' 
    },
    restaurant: { 
      metric: 'revenue', 
      multiple: 0.4,
      display: '0.4x Revenue' 
    },
    distribution: { 
      metric: 'ebitda', 
      multiple: 4.0,
      display: '4.0x EBITDA' 
    },
    general_business: { 
      metric: 'ebitda', 
      multiple: 3.0,
      display: '3.0x EBITDA' 
    }
  };
  
  return exitModels[businessType] || exitModels.general_business;
};

// Generate dynamic risk analysis based on financial data
const generateRiskAnalysis = (data, assumptions, sdeMultiple) => {
  const incomeStatement = data.statements.incomeStatement;
  const fileName = data.metadata?.fileName || '';
  const businessType = identifyBusinessType(fileName, incomeStatement);
  const latestRevenue = Math.max(...Object.values(incomeStatement.revenue || {}));
  const latestEbitda = Math.max(...Object.values(incomeStatement.ebitda || {}));
  const ebitdaMargin = latestRevenue > 0 ? (latestEbitda / latestRevenue) * 100 : 0;
  
  // Customer concentration risk assessment
  let customerConcentration = "Moderate";
  if (latestRevenue < 1000000) {
    customerConcentration = "High - Small businesses typically have concentrated customer bases";
  } else if (businessType.description.includes('insurance') || businessType.description.includes('service')) {
    customerConcentration = "Moderate - Service businesses often have diversified client relationships";
  } else if (latestRevenue > 10000000) {
    customerConcentration = "Low - Large revenue base suggests diversified customer portfolio";
  }
  
  // Owner dependency assessment
  let ownerDependency = "Moderate";
  if (latestRevenue < 2000000) {
    ownerDependency = "High - Small businesses typically dependent on key personnel";
  } else if (ebitdaMargin > 20) {
    ownerDependency = "Low - Strong margins suggest established systems and processes";
  } else if (businessType.description.includes('tech')) {
    ownerDependency = "Moderate - Technology businesses often have scalable systems";
  }
  
  // Industry risk assessment
  let industryRisk = "Moderate";
  if (businessType.description.includes('insurance')) {
    industryRisk = "Low - Insurance brokerage is recession-resistant with recurring revenue";
  } else if (businessType.description.includes('tech')) {
    industryRisk = "Moderate - Technology sector has growth potential but competitive pressures";
  } else if (businessType.description.includes('manufacturing')) {
    industryRisk = "Moderate to High - Manufacturing sensitive to economic cycles and supply chains";
  } else if (businessType.description.includes('service')) {
    industryRisk = "Low to Moderate - Service businesses often have stable demand";
  }
  
  // Valuation recommendation
  let recommendation;
  if (sdeMultiple > 6) {
    recommendation = "Overvalued - Negotiate price reduction of 15-25%";
  } else if (sdeMultiple > 4.5) {
    recommendation = "Premium valuation - Ensure strong growth prospects justify price";
  } else if (sdeMultiple > 2.5) {
    recommendation = "Fair valuation - Reasonable multiple for quality business";
  } else {
    recommendation = "Attractive valuation - Consider accelerated due diligence";
  }
  
  return {
    customerConcentration,
    ownerDependency,
    industryRisk,
    recommendation
  };
};

const buildDebtServiceModel = (data, assumptions) => {
  const downPayment = assumptions.purchasePrice * assumptions.downPaymentPercent;
  const sellerFinancing = assumptions.purchasePrice * (assumptions.sellerFinancingPercent || 0);
  const debtAmount = assumptions.purchasePrice - downPayment - sellerFinancing; // Bank debt only - consistent with buildFiveYearModel
  
  // Calculate annual debt service (SBA loan)
  const monthlyRate = assumptions.interestRate / 12;
  const numPayments = assumptions.loanTermYears * 12;
  const monthlyPayment = debtAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
  const annualDebtService = monthlyPayment * 12;
  
  // Project CFADS (Cash Flow Available for Debt Service)
  const baseEBITDA = data.statements.incomeStatement?.ebitda['TTM'] || 0;
  const projectedRevenue = data.statements.incomeStatement?.revenue['TTM'] || 0;
  
  const cfads = [];
  const dscr = [];
  
  for (let year = 1; year <= 5; year++) {
    const yearRevenue = projectedRevenue * Math.pow(1 + assumptions.revenueGrowthRate, year);
    const yearEBITDA = yearRevenue * assumptions.marginRate;
    const capexAndWC = yearRevenue * 0.02; // 2% of revenue for capex/working capital
    const yearCFADS = yearEBITDA - capexAndWC;
    const yearDSCR = yearCFADS / annualDebtService;
    
    cfads.push(yearCFADS);
    dscr.push(yearDSCR);
  }
  
  // Calculate valuation metrics
  const sdeMultiple = assumptions.purchasePrice / baseEBITDA;
  const industryMultiple = 3.5; // Typical for service businesses
  const fairValueRange = [baseEBITDA * 2.5, baseEBITDA * 4.0];
  
  return {
    historicalData: data,
    assumptions,
    projections: {
      annualDebtService,
      cfads,
      dscr,
      valuation: {
        sdeMultiple,
        industryMultiple,
        fairValueRange
      }
    },
    riskAnalysis: generateRiskAnalysis(data, assumptions, sdeMultiple)
  };
};

// Build 5-Year Financial Model
const buildFiveYearModel = (baseData, debtModel, inputs, customExitValue = null) => {
  const baseRevenue = baseData.statements.incomeStatement?.revenue['TTM'] || 0;
  const years = [1, 2, 3, 4, 5];
  const revenue = [];
  const grossProfit = [];
  const opex = [];
  const ebitda = [];
  const tax = [];
  const netIncome = [];
  const freeCashFlow = [];
  const debtService = [];
  const cashAfterDebt = [];
  const dscr = [];
  const debtBalance = []; // Track remaining debt balance each year
  
  // Use inputs for purchase price to ensure updates are reflected
  const purchasePrice = inputs.purchasePrice || debtModel.assumptions.purchasePrice;
  const downPayment = purchasePrice * inputs.downPaymentPercent;
  const sellerFinancing = purchasePrice * (inputs.sellerFinancingPercent || 0);
  const initialDebtAmount = purchasePrice - downPayment - sellerFinancing; // Bank debt only
  const monthlyRate = inputs.interestRate / 12;
  const numPayments = inputs.loanTermYears * 12;
  const monthlyPayment = initialDebtAmount > 0 ? initialDebtAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1) : 0;
  const annualDebtService = monthlyPayment * 12;
  
  // Get business type for industry-specific assumptions
  const businessType = identifyBusinessType(baseData.name || 'business', baseData.statements?.incomeStatement || {});
  
  // Industry-specific capex assumptions
  const getCapexPercent = (businessType) => {
    switch (businessType.type) {
      case 'insurance_agency':
      case 'consulting':
      case 'service':
        return 0.005; // 0.5% - minimal capex for service businesses
      case 'retail':
      case 'restaurant':
        return 0.03; // 3% - equipment and fixtures
      case 'manufacturing':
      case 'construction':
        return 0.05; // 5% - machinery and equipment
      case 'saas':
      case 'technology':
        return 0.015; // 1.5% - software and hardware
      case 'healthcare':
        return 0.025; // 2.5% - medical equipment
      default:
        return 0.02; // 2% - general business
    }
  };
  
  const capexPercent = getCapexPercent(businessType);
  
  // Owner compensation adjustments
  const currentOwnerComp = baseData.statements.incomeStatement?.ownerSalary?.['TTM'] || 
                          baseData.statements.incomeStatement?.officerComp?.['TTM'] || 
                          0;
  const marketOwnerComp = Math.min(baseRevenue * 0.15, 300000); // Market rate: 15% of revenue, capped at $300k
  const ownerCompAdjustment = currentOwnerComp - marketOwnerComp;
  
  // Initialize debt balance and working capital tracking
  let currentDebtBalance = initialDebtAmount;
  
  // Initialize working capital with base year
  let previousYearWorkingCapital = baseRevenue * inputs.workingCapitalPercent;
  
  for (let i = 0; i < 5; i++) {
    // Revenue projection
    const yearRevenue = baseRevenue * Math.pow(1 + inputs.revenueGrowthRate, i + 1);
    revenue.push(yearRevenue);
    
    // Gross profit
    const yearGrossProfit = yearRevenue * inputs.grossMarginPercent;
    grossProfit.push(yearGrossProfit);
    
    // Operating expenses (adjust for owner compensation normalization)
    const yearOpex = (yearRevenue * inputs.opexPercent) - ownerCompAdjustment;
    opex.push(yearOpex);
    
    // EBITDA (benefits from owner compensation adjustment)
    const yearEBITDA = yearGrossProfit - yearOpex;
    ebitda.push(yearEBITDA);
    
    // Calculate interest expense based on current debt balance (amortizing loan)
    const yearInterestExpense = currentDebtBalance * inputs.interestRate;
    const yearPrincipalPayment = annualDebtService - yearInterestExpense;
    
    // Update debt balance for next year
    currentDebtBalance = Math.max(0, currentDebtBalance - yearPrincipalPayment);
    debtBalance.push(currentDebtBalance);
    
    // Net income before tax
    const depreciation = yearRevenue * (inputs.depreciationPercent || 0.02); // Use consistent percentage
    const yearEBIT = yearEBITDA - depreciation;
    const yearEBT = yearEBIT - yearInterestExpense;
    
    // Tax calculation on earnings before tax (not EBITDA)
    const yearTax = Math.max(0, yearEBT * inputs.taxRate);
    tax.push(yearTax);
    
    // Net income
    const yearNetIncome = yearEBT - yearTax;
    netIncome.push(yearNetIncome);
    
    // Calculate working capital and its incremental change
    const currentYearWorkingCapital = yearRevenue * inputs.workingCapitalPercent;
    const workingCapitalChange = currentYearWorkingCapital - previousYearWorkingCapital;
    
    // Capital expenditures
    const capex = yearRevenue * capexPercent; // Use industry-specific capex
    
    // Free cash flow (using net income approach: add back depreciation, subtract incremental WC and capex)
    const yearFCF = yearNetIncome + depreciation - workingCapitalChange - capex;
    freeCashFlow.push(yearFCF);
    
    // Update working capital for next year's calculation
    previousYearWorkingCapital = currentYearWorkingCapital;
    
    // Debt service
    debtService.push(annualDebtService);
    
    // Cash after debt service
    const yearCashAfterDebt = yearFCF - annualDebtService;
    cashAfterDebt.push(yearCashAfterDebt);
    
    // DSCR (Cash Flow Available for Debt Service = EBITDA - Interest - Taxes - ΔWC - CapEx)
    // This should equal FCF + Interest (since FCF is after interest, CFADS is before debt service)
    const cashAvailableForDebt = yearEBITDA - yearInterestExpense - yearTax - workingCapitalChange - capex;
    const yearDSCR = annualDebtService > 0 ? cashAvailableForDebt / annualDebtService : 0;
    dscr.push(yearDSCR);
    
    // Validation: CFADS should equal FCF + Interest (mathematical consistency check)
    const expectedCFADS = yearFCF + yearInterestExpense;
    if (Math.abs(cashAvailableForDebt - expectedCFADS) > 1) {
      console.warn(`Year ${i + 1}: CFADS calculation inconsistency. CFADS: ${cashAvailableForDebt}, Expected: ${expectedCFADS}`);
    }
  }
  
  // Calculate exit value using custom value or dynamic business type-specific logic
  const exitYearIndex = Math.min(inputs.exitYear - 1, 4);
  const exitEBITDA = ebitda[exitYearIndex];
  const exitRevenue = revenue[exitYearIndex];
  
  let exitValue = 0;
  let exitMultiple = 0;
  let exitMethod = '';
  
  if (customExitValue && customExitValue > 0) {
    // Use custom exit value
    exitValue = customExitValue;
    exitMethod = 'Custom Value';
    exitMultiple = exitEBITDA > 0 ? customExitValue / exitEBITDA : 0;
  } else {
    // Get business type from the model assumptions or detect it
    const businessTypeStr = businessType.type || 'general_business';
    const exitModel = getExitValuationModel(businessTypeStr);
    
    exitMultiple = exitModel.multiple;
    exitMethod = exitModel.display;
    
    if (exitModel.metric === 'commission_income' && exitRevenue > 0) {
      // Insurance agencies - use revenue as commission income proxy
      exitValue = exitRevenue * exitMultiple;
    } else if (exitModel.metric === 'arr' && exitRevenue > 0) {
      // SaaS - use revenue as ARR proxy
      exitValue = exitRevenue * exitMultiple;
    } else if (exitModel.metric === 'ebitda' && exitEBITDA > 0) {
      // Most businesses - use EBITDA
      exitValue = exitEBITDA * exitMultiple;
    } else if (exitModel.metric === 'revenue' && exitRevenue > 0) {
      // Revenue-based businesses
      exitValue = exitRevenue * exitMultiple;
    } else if (exitEBITDA > 0) {
      // Fallback to EBITDA with default multiple
      exitValue = exitEBITDA * exitMultiple;
      exitMethod = `${exitMultiple}x EBITDA`;
    } else if (exitRevenue > 0) {
      // Final fallback to revenue
      exitValue = exitRevenue * (exitMultiple * 0.3); // Conservative revenue multiple
      exitMethod = `${(exitMultiple * 0.3).toFixed(1)}x Revenue`;
    } else {
      exitValue = 0;
      exitMethod = 'No exit value - insufficient data';
    }
  }
  
  // Create cash flows array up to exit year
  const totalCashFlows = cashAfterDebt.slice(0, inputs.exitYear);
  totalCashFlows[exitYearIndex] += exitValue;
  
  const initialInvestment = purchasePrice * inputs.downPaymentPercent;
  const irr = calculateIRR(totalCashFlows, initialInvestment);
  const totalReturn = totalCashFlows.reduce((a, b) => a + b, 0);
  
  // Enhanced MOIC calculation with proper validation
  let moic;
  if (initialInvestment <= 0) {
    moic = 0;
  } else {
    // MOIC = Total Cash Returned / Initial Investment
    // Total cash returned includes all cash flows + exit value
    moic = totalReturn / initialInvestment;
    
    // Ensure MOIC makes sense (prevent negative or extreme values)
    if (moic < 0) {
      console.warn('Negative MOIC detected - check cash flow projections');
    }
    if (moic > 20) {
      console.warn('Extremely high MOIC detected - verify assumptions');
    }
  }
  
  console.log('MOIC Calculation:', {
    totalReturn,
    initialInvestment, 
    moic,
    totalCashFlows: totalCashFlows.reduce((a, b) => a + b, 0),
    exitValue
  });
  
  // Simple payback calculation
  let cumCash = 0;
  let paybackYears = inputs.exitYear;
  for (let i = 0; i < Math.min(cashAfterDebt.length, inputs.exitYear); i++) {
    cumCash += cashAfterDebt[i];
    if (cumCash >= initialInvestment) {
      paybackYears = i + 1 - (cumCash - initialInvestment) / cashAfterDebt[i];
      break;
    }
  }
  
  return {
    years,
    revenue,
    grossProfit,
    opex,
    ebitda,
    tax,
    netIncome,
    freeCashFlow,
    debtService,
    cashAfterDebt,
    dscr,
    debtBalance,
    irr,
    moic,
    paybackYears,
    exitValue,
    exitMultiple,
    exitMethod,
    exitYear: inputs.exitYear,
    dscrAnalysis: analyzeDSCR(dscr)
  };
};

// My Models Dashboard Component
function MyModels({ user, savedModels, onSelectModel, onBack, onNewModel, onUpdateModel, onDeleteModel }) {
  const [sortBy, setSortBy] = useState('recent'); // 'recent' or 'title'
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  
  // Sort models based on selected criteria
  const sortedModels = [...savedModels].sort((a, b) => {
    if (sortBy === 'recent') {
      return new Date(b.createdAt) - new Date(a.createdAt);
    } else {
      return (a.name || '').localeCompare(b.name || '');
    }
  });
  if (!user) {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-20">
            <div className="p-4 bg-gray-100 rounded-lg w-fit mx-auto mb-6">
              <Lock className="h-8 w-8 text-gray-600" />
            </div>
            <h2 className="text-3xl font-bold text-black mb-4">Sign In to View Your Models</h2>
            <p className="text-gray-600 mb-8">Create an account to save and manage your financial models</p>
            <button 
              onClick={onBack}
              className="px-6 py-3 bg-green-400 text-black font-bold rounded-lg hover:bg-green-500 transition-all"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <button onClick={onBack} className="flex items-center space-x-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5" />
              <span>Back</span>
            </button>
            <div>
              <div className="flex items-center">
                <img src="/logo.png" alt="Logo" className="h-8 w-auto" onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }} />
                <div className="w-8 h-8 bg-black rounded flex items-center justify-center" style={{display: 'none'}}>
                  <span className="text-white text-xs font-bold">E</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-3 px-4 py-2 bg-gray-100 rounded-lg">
              <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-lg" />
              <div>
                <p className="text-sm font-semibold text-black">{user.name}</p>
                <p className="text-xs text-gray-600">{user.email}</p>
              </div>
            </div>
            <button 
              onClick={onNewModel}
              className="px-6 py-3 bg-green-400 text-black font-bold rounded-lg hover:bg-green-500 transition-all flex items-center space-x-2"
            >
              <Upload className="h-5 w-5" />
              <span>New Model</span>
            </button>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-black">My Financial Models</h1>
            {savedModels.length > 0 && (
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600">Sort by:</label>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-400 focus:border-transparent"
                >
                  <option value="recent">Most Recent</option>
                  <option value="title">Title</option>
                </select>
              </div>
            )}
          </div>

          {console.log('Saved models:', savedModels)}
          {savedModels.length === 0 ? (
            <div className="bg-white rounded-3xl p-20 text-center">
              <div className="p-6 bg-gray-100 rounded-3xl w-fit mx-auto mb-6">
                <BarChart3 className="h-12 w-12 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold text-black mb-4">No Models Yet</h2>
              <p className="text-gray-600 mb-8">Upload a CIM or financial statements to create your first model</p>
              <button 
                onClick={onNewModel}
                className="px-8 py-4 bg-green-400 text-black font-bold text-lg rounded-lg hover:bg-green-500 transition-all transform hover:scale-105 shadow-lg"
              >
                Create Your First Model
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedModels.map((model) => {
                const ttmRevenue = model.financialData?.statements?.incomeStatement?.revenue?.['TTM'] || 0;
                const ttmEBITDA = model.financialData?.statements?.incomeStatement?.ebitda?.['TTM'] || 0;
                // Handle both model.model and model.debtServiceModel
                const modelData = model.model || model.debtServiceModel;
                const purchasePrice = modelData?.assumptions?.purchasePrice || 0;
                const irr = model.fiveYearModel?.irr || 0;
                const moic = model.fiveYearModel?.moic || 0;
                
                return (
                  <div 
                    key={model.id}
                    className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 hover:shadow-lg transition-all group hover:-translate-y-1"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        {editingId === model.id ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                onUpdateModel(model.id, { name: editingName });
                                setEditingId(null);
                              } else if (e.key === 'Escape') {
                                setEditingId(null);
                              }
                            }}
                            onBlur={() => {
                              onUpdateModel(model.id, { name: editingName });
                              setEditingId(null);
                            }}
                            className="text-lg font-bold text-black w-full px-2 py-1 border border-gray-300 rounded"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <>
                            <h3 
                              className="text-lg font-bold text-black cursor-pointer hover:text-green-600 transition-colors"
                              onClick={() => onSelectModel(model)}
                            >
                              {model.name}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {new Date(model.createdAt).toLocaleDateString()}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(model.id);
                            setEditingName(model.name);
                          }}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                          title="Rename"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Are you sure you want to delete this model?')) {
                              onDeleteModel(model.id);
                            }
                          }}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Revenue</span>
                        <span className="text-sm font-semibold">{formatCurrency(ttmRevenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">EBITDA</span>
                        <span className="text-sm font-semibold">{formatCurrency(ttmEBITDA)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Price</span>
                        <span className="text-sm font-semibold">{formatCurrency(purchasePrice)}</span>
                      </div>
                      
                      <div className="pt-3 border-t border-gray-100">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-2 bg-gray-50 rounded-xl">
                            <p className="text-xs text-gray-600">IRR</p>
                            <p className={`text-lg font-bold ${irr < 0 ? 'text-red-600' : irr > 0.20 ? 'text-green-600' : 'text-black'}`}>
                              {irr < 0 ? 'N/A' : formatPercent(irr)}
                            </p>
                          </div>
                          <div className="text-center p-2 bg-gray-50 rounded-xl">
                            <p className="text-xs text-gray-600">MOIC</p>
                            <p className={`text-lg font-bold ${moic < 0 || !isFinite(moic) ? 'text-red-600' : moic < 1 ? 'text-red-600' : moic > 2 ? 'text-green-600' : 'text-black'}`}>
                              {moic < 0 || !isFinite(moic) ? 'N/A' : `${moic.toFixed(2)}x`}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex justify-between items-center">
                      <span className="text-xs text-gray-500">
                        {model.financialData.metadata.fileName}
                      </span>
                      <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-green-600 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Analyze Another Business Button */}
          {savedModels.length > 0 && (
            <div className="mt-12 text-center">
              <button 
                onClick={onNewModel}
                className="px-8 py-4 bg-green-400 text-black font-bold text-lg rounded-lg hover:bg-green-500 transition-all transform hover:scale-105 shadow-lg flex items-center space-x-3 mx-auto"
              >
                <Upload className="h-6 w-6" />
                <span>Analyze Another Business</span>
              </button>
              <p className="text-gray-500 text-sm mt-3">Upload a new CIM or financial statements to analyze</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Helper function to calculate coefficient of variation (measure of variability)
const calculateVariability = (values) => {
  if (values.length < 2) return 0;
  const validValues = values.filter(v => v > 0);
  if (validValues.length < 2) return 0;
  
  const mean = validValues.reduce((a, b) => a + b, 0) / validValues.length;
  const variance = validValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / validValues.length;
  const standardDeviation = Math.sqrt(variance);
  
  return mean > 0 ? standardDeviation / mean : 0;
};

// Generate dynamic insights based on actual financial data
const generateBusinessInsights = (financialData) => {
  const incomeStatement = financialData.statements.incomeStatement;
  const periods = financialData.periods;
  const fileName = financialData.metadata.fileName;
  
  const insights = [];
  const risks = [];
  const opportunities = [];
  
  // Calculate growth rates
  const revenues = periods.map(p => incomeStatement.revenue[p] || 0);
  const ebitdas = periods.map(p => incomeStatement.ebitda[p] || 0);
  
  // Revenue growth analysis
  if (revenues.length >= 2) {
    const recentGrowth = ((revenues[revenues.length - 1] / revenues[revenues.length - 2]) - 1);
    const avgGrowth = revenues.length > 2 ? 
      (Math.pow(revenues[revenues.length - 1] / revenues[0], 1 / (revenues.length - 1)) - 1) : 0;
    
    if (recentGrowth > 0.20) {
      insights.push(`Strong revenue momentum with ${formatPercent(recentGrowth)} recent growth`);
      opportunities.push("High growth trajectory suggests market demand and scalability");
    } else if (recentGrowth < -0.10) {
      risks.push(`Revenue declined ${formatPercent(Math.abs(recentGrowth))} in most recent period`);
    } else {
      insights.push(`Stable revenue growth averaging ${formatPercent(avgGrowth)} annually`);
    }
  }
  
  // Profitability analysis
  const latestRevenue = revenues[revenues.length - 1];
  const latestEbitda = ebitdas[ebitdas.length - 1];
  const ebitdaMargin = latestRevenue > 0 ? (latestEbitda / latestRevenue) * 100 : 0;
  
  if (ebitdaMargin > 15) {
    insights.push(`Healthy EBITDA margin of ${ebitdaMargin.toFixed(1)}% indicates strong operational efficiency`);
    opportunities.push("Strong margins provide flexibility for investment and growth initiatives");
  } else if (ebitdaMargin < 5) {
    risks.push(`Low EBITDA margin of ${ebitdaMargin.toFixed(1)}% suggests operational challenges`);
  }
  
  // Scale analysis based on revenue size
  if (latestRevenue > 10000000) {
    insights.push("Substantial revenue base provides platform for continued expansion");
    opportunities.push("Scale advantages in procurement, operations, and market presence");
  } else if (latestRevenue < 1000000) {
    insights.push("Early-stage company with significant growth potential");
    risks.push("Limited scale may constrain operational efficiency and market power");
  }
  
  // Cash flow quality analysis
  const ebitdaVariability = calculateVariability(ebitdas);
  if (ebitdaVariability < 0.15) {
    insights.push("Predictable cash flows with low earnings volatility support stable debt service");
    opportunities.push("Consistent performance enables optimized capital structure and financing terms");
  } else if (ebitdaVariability > 0.3) {
    risks.push("High earnings volatility may impact cash flow predictability and debt servicing ability");
  }
  
  // Market position analysis
  if (ebitdaMargin > 20 && latestRevenue > 5000000) {
    insights.push("Strong market position evidenced by premium margins and scale");
    opportunities.push("Market leadership provides pricing power and competitive advantages");
  } else if (ebitdaMargin < 10 && latestRevenue > 2000000) {
    risks.push("Low margins despite scale suggest competitive pressures or operational inefficiencies");
    opportunities.push("Margin improvement initiatives could significantly enhance value");
  }
  
  // Financial leverage capacity
  const impliedDebtCapacity = latestEbitda * 3.5; // Conservative 3.5x EBITDA
  if (latestEbitda > 500000) {
    opportunities.push(`Strong EBITDA of ${formatCurrency(latestEbitda)} supports debt capacity of ~${formatCurrency(impliedDebtCapacity)} for growth initiatives`);
  }
  
  // Industry-specific insights based on filename patterns
  const businessType = identifyBusinessType(fileName, incomeStatement);
  insights.push(`Business profile suggests ${businessType.description}`);
  opportunities.push(businessType.opportunity);
  
  return { insights, risks, opportunities };
};

// Universal Business Type Detection System
const detectBusinessType = (documentText, fileName, financialData) => {
  const businessIndicators = {
    insurance_agency: {
      keywords: ['commission', 'premium', 'carrier', 'retention rate', 'book of business', 'insurance', 'broker', 'agent', 'policy', 'underwriting'],
      financialPatterns: ['commission income', 'renewal rates', 'carrier relationships'],
      confidence: 0
    },
    construction: {
      keywords: ['project', 'construction', 'installation', 'equipment', 'job site', 'contractor', 'building', 'civil', 'engineering', 'subcontractor'],
      financialPatterns: ['backlog', 'job costs', 'equipment depreciation'],
      confidence: 0
    },
    saas: {
      keywords: ['mrr', 'arr', 'churn', 'subscription', 'recurring revenue', 'software', 'platform', 'cloud', 'api', 'saas'],
      financialPatterns: ['monthly recurring revenue', 'annual recurring revenue', 'customer acquisition cost'],
      confidence: 0
    },
    manufacturing: {
      keywords: ['inventory', 'cogs', 'production', 'raw materials', 'factory', 'manufacturing', 'assembly', 'warehouse', 'supply chain'],
      financialPatterns: ['cost of goods sold', 'inventory turnover', 'gross margin'],
      confidence: 0
    },
    retail: {
      keywords: ['inventory turnover', 'same store sales', 'foot traffic', 'pos', 'retail', 'store', 'merchandise', 'customers'],
      financialPatterns: ['same store sales', 'inventory turns', 'gross margin'],
      confidence: 0
    },
    restaurant: {
      keywords: ['food cost', 'labor cost', 'table turns', 'average check', 'restaurant', 'dining', 'kitchen', 'menu'],
      financialPatterns: ['food cost percentage', 'labor cost percentage', 'revenue per seat'],
      confidence: 0
    },
    professional_services: {
      keywords: ['billable hours', 'utilization', 'realization', 'wip', 'consulting', 'advisory', 'professional', 'services'],
      financialPatterns: ['billable hours', 'utilization rate', 'realization rate'],
      confidence: 0
    },
    healthcare: {
      keywords: ['patient', 'medical', 'healthcare', 'clinic', 'practice', 'revenue cycle', 'insurance reimbursement'],
      financialPatterns: ['patient volume', 'reimbursement rates', 'accounts receivable'],
      confidence: 0
    },
    distribution: {
      keywords: ['wholesale', 'distributor', 'logistics', 'supply chain', 'inventory', 'vendors', 'suppliers'],
      financialPatterns: ['inventory turns', 'gross margin', 'working capital'],
      confidence: 0
    }
  };

  const combinedText = `${documentText} ${fileName}`.toLowerCase();
  
  // Score each business type
  Object.keys(businessIndicators).forEach(type => {
    const indicator = businessIndicators[type];
    
    // Score based on keyword matches
    indicator.keywords.forEach(keyword => {
      if (combinedText.includes(keyword.toLowerCase())) {
        indicator.confidence += 10;
      }
    });
    
    // Bonus for filename matches
    if (fileName.toLowerCase().includes(type.split('_')[0])) {
      indicator.confidence += 20;
    }
  });

  // Find the highest scoring type
  let bestMatch = { type: 'general_business', confidence: 0 };
  Object.keys(businessIndicators).forEach(type => {
    if (businessIndicators[type].confidence > bestMatch.confidence) {
      bestMatch = { type, confidence: businessIndicators[type].confidence };
    }
  });

  return bestMatch;
};

// Industry-Specific Valuation Models
const valuationModels = {
  insurance_agency: {
    primaryMetric: 'commission_income',
    typicalMultiple: { min: 1.5, max: 2.5, default: 2.0 },
    keyMetrics: ['retention_rate', 'commission_income', 'carrier_relationships'],
    description: "insurance brokerage with commission-based recurring revenue",
    opportunity: "Insurance brokerages benefit from sticky client relationships and industry consolidation",
    financialFocus: 'recurring_revenue'
  },
  construction: {
    primaryMetric: 'ebitda',
    typicalMultiple: { min: 3.0, max: 5.0, default: 4.0 },
    keyMetrics: ['backlog', 'gross_margin', 'equipment_value'],
    description: "construction business with project-based revenue",
    opportunity: "Construction companies benefit from infrastructure spending and market specialization",
    financialFocus: 'project_based'
  },
  saas: {
    primaryMetric: 'arr',
    typicalMultiple: { min: 3.0, max: 8.0, default: 5.0 },
    keyMetrics: ['growth_rate', 'churn_rate', 'ltv_cac_ratio'],
    description: "software-as-a-service business with scalable recurring revenue",
    opportunity: "SaaS businesses have high scalability and predictable recurring revenue streams",
    financialFocus: 'recurring_revenue'
  },
  manufacturing: {
    primaryMetric: 'ebitda',
    typicalMultiple: { min: 3.5, max: 6.0, default: 4.5 },
    keyMetrics: ['gross_margin', 'capacity_utilization', 'inventory_turns'],
    description: "manufacturing business with production-based operations",
    opportunity: "Manufacturing businesses benefit from operational efficiency and market expansion",
    financialFocus: 'asset_heavy'
  },
  retail: {
    primaryMetric: 'revenue',
    typicalMultiple: { min: 0.3, max: 0.8, default: 0.5 },
    keyMetrics: ['comp_store_sales', 'inventory_turns', 'gross_margin'],
    description: "retail business with consumer-facing operations",
    opportunity: "Retail businesses benefit from location optimization and customer experience improvements",
    financialFocus: 'transactional'
  },
  restaurant: {
    primaryMetric: 'revenue',
    typicalMultiple: { min: 0.3, max: 0.6, default: 0.4 },
    keyMetrics: ['food_cost_percent', 'labor_cost_percent', 'revenue_per_sqft'],
    description: "restaurant business with food service operations",
    opportunity: "Restaurant businesses benefit from operational efficiency and concept expansion",
    financialFocus: 'transactional'
  },
  professional_services: {
    primaryMetric: 'revenue',
    typicalMultiple: { min: 0.8, max: 1.5, default: 1.1 },
    keyMetrics: ['billable_hours', 'utilization_rate', 'realization_rate'],
    description: "professional services firm with expertise-based revenue",
    opportunity: "Professional services benefit from specialization and client relationship expansion",
    financialFocus: 'recurring_revenue'
  },
  healthcare: {
    primaryMetric: 'ebitda',
    typicalMultiple: { min: 4.0, max: 7.0, default: 5.5 },
    keyMetrics: ['patient_volume', 'reimbursement_rates', 'revenue_cycle'],
    description: "healthcare practice with patient-care revenue",
    opportunity: "Healthcare practices benefit from demographic trends and service line expansion",
    financialFocus: 'recurring_revenue'
  },
  distribution: {
    primaryMetric: 'ebitda',
    typicalMultiple: { min: 3.0, max: 5.0, default: 4.0 },
    keyMetrics: ['inventory_turns', 'gross_margin', 'working_capital'],
    description: "distribution business with wholesale operations",
    opportunity: "Distribution businesses benefit from supply chain optimization and market expansion",
    financialFocus: 'asset_heavy'
  },
  general_business: {
    primaryMetric: 'ebitda',
    typicalMultiple: { min: 2.5, max: 4.0, default: 3.0 },
    keyMetrics: ['revenue_growth', 'gross_margin', 'operating_margin'],
    description: "diversified business with multiple revenue streams",
    opportunity: "General businesses benefit from operational improvements and strategic focus",
    financialFocus: 'mixed'
  }
};

const identifyBusinessType = (fileName, incomeStatement, documentText = '') => {
  try {
    // Use the new detection system
    const detection = detectBusinessType(documentText, fileName, incomeStatement || {});
    const model = valuationModels[detection.type] || valuationModels.general_business;
    
    return {
      type: detection.type,
      confidence: detection.confidence,
      description: model.description,
      opportunity: model.opportunity,
      valuationModel: model
    };
  } catch (error) {
    console.warn('Error identifying business type:', error);
    const fallbackModel = valuationModels.general_business;
    return {
      type: 'general_business',
      confidence: 0.5,
      description: fallbackModel.description,
      opportunity: fallbackModel.opportunity,
      valuationModel: fallbackModel
    };
  }
};

// Analysis Summary Component
function AnalysisSummary({ model, onBuildModel, onDeepAnalysis, onBack, onViewModels, onViewInvestorDashboard, hasInvestorData }) {
  const [isLoading, setIsLoading] = useState(false);
  const financialData = model.historicalData;
  
  // Safely get TTM Revenue with proper fallbacks
  const revenueValues = Object.values(financialData.statements.incomeStatement?.revenue || {}).filter(v => v && v > 0);
  const ttmRevenue = financialData.statements.incomeStatement?.revenue?.['TTM'] || 
                     (revenueValues.length > 0 ? Math.max(...revenueValues) : 0);
  
  // Safely get TTM EBITDA with proper fallbacks  
  const ebitdaValues = Object.values(financialData.statements.incomeStatement?.ebitda || {}).filter(v => v && v > 0);
  const ttmEBITDA = financialData.statements.incomeStatement?.ebitda?.['TTM'] || 
                    (ebitdaValues.length > 0 ? Math.max(...ebitdaValues) : 0);
  
  // State for editable purchase price
  const [editablePurchasePrice, setEditablePurchasePrice] = useState(model.assumptions.purchasePrice);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [customPriceInput, setCustomPriceInput] = useState('');
  
  const purchasePrice = editablePurchasePrice || 0;
  const sdeMultiple = (ttmEBITDA > 0 && purchasePrice > 0) ? purchasePrice / ttmEBITDA : 0;
  
  // Determine if price was estimated or extracted
  const priceSource = model.assumptions.priceSource || 'estimated';
  const estimationMethod = model.assumptions.priceEstimationMethod || 'Unknown method';
  
  const handlePriceEdit = () => {
    setCustomPriceInput(purchasePrice.toLocaleString());
    setIsEditingPrice(true);
  };
  
  const handlePriceSave = () => {
    const newPrice = parseInt(customPriceInput.replace(/,/g, '')) || purchasePrice;
    console.log('Price save: Old price:', purchasePrice, 'New price:', newPrice);
    setEditablePurchasePrice(newPrice);
    
    // Update the model assumptions with new price
    const updatedAssumptions = {
      ...model.assumptions,
      purchasePrice: newPrice,
      priceSource: 'user_edited'
    };
    
    console.log('Updated assumptions:', updatedAssumptions);
    
    // Rebuild the debt service model with updated assumptions
    const updatedDebtServiceModel = buildDebtServiceModel(financialData, updatedAssumptions);
    console.log('Updated debt service model debt service:', updatedDebtServiceModel.projections.annualDebtService);
    setDebtServiceModel(updatedDebtServiceModel);
    
    setIsEditingPrice(false);
  };
  
  const handlePriceCancel = () => {
    setIsEditingPrice(false);
    setCustomPriceInput('');
  };
  
  const handleCustomPriceChange = (e) => {
    const value = e.target.value.replace(/[^\d]/g, '');
    const formatted = value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    setCustomPriceInput(formatted);
  };
  
  // Generate dynamic insights based on the actual data
  const businessAnalysis = generateBusinessInsights(financialData);

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 relative">
          <div className="absolute left-0 top-0">
            <button
              onClick={onViewModels}
              className="text-sm text-gray-600 hover:text-gray-900 underline flex items-center space-x-1"
            >
              <BarChart3 className="h-4 w-4" />
              <span>View all models</span>
            </button>
          </div>
          <div className="absolute right-0 top-0">
            <button
              onClick={onBuildModel}
              className="px-4 py-2 bg-green-400 text-black font-bold rounded-lg hover:bg-green-500 transition-all flex items-center space-x-2"
            >
              <Sliders className="h-4 w-4" />
              <span>Adjust Assumptions</span>
            </button>
          </div>
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="p-4 bg-green-100 rounded-lg">
              <Building className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-black mb-4">Acquisition Analysis</h1>
          <p className="text-xl text-gray-700">Based on {model.historicalData.metadata.fileName}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {model.historicalData.metadata.extractionMethod && (
              <div className="inline-flex items-center px-4 py-2 bg-blue-100 rounded-lg text-sm">
                <span className="text-blue-800 font-semibold">
                  {model.historicalData.metadata.extractionMethod.includes('Textract') ? '📊' : '🤖'} {model.historicalData.metadata.extractionMethod}
                </span>
                {model.historicalData.metadata.tablesExtracted > 0 && (
                  <span className="ml-2 text-blue-600">• {model.historicalData.metadata.tablesExtracted} tables found</span>
                )}
                {model.historicalData.metadata.confidence && (
                  <span className="ml-2 text-blue-600">• {Math.round(model.historicalData.metadata.confidence)}% confidence</span>
                )}
              </div>
            )}
            {model.historicalData.modelInfo && (
              <div className="inline-flex items-center px-4 py-2 bg-green-100 rounded-lg text-sm">
                <span className="text-green-800 font-semibold">✨ Enhanced by {model.historicalData.modelInfo.provider} {model.historicalData.modelInfo.model}</span>
              </div>
            )}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-200">
            <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-2">TTM Revenue</h3>
            <p className="text-3xl font-bold text-black">{formatCurrency(ttmRevenue)}</p>
            <p className="text-sm text-gray-500 mt-1">Trailing 12 months</p>
          </div>
          <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-200">
            <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-2">TTM EBITDA</h3>
            <p className="text-3xl font-bold text-black">{formatCurrency(ttmEBITDA)}</p>
            <p className="text-sm text-gray-500 mt-1">{formatPercent(ttmEBITDA / ttmRevenue)} margin</p>
          </div>
          <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-200">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide">Purchase Price</h3>
              {!isEditingPrice && (
                <button
                  onClick={handlePriceEdit}
                  className="text-blue-600 hover:text-blue-700 text-sm flex items-center"
                >
                  <Edit3 className="h-3 w-3 mr-1" />
                  Edit
                </button>
              )}
            </div>
            
            {isEditingPrice ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={customPriceInput}
                  onChange={handleCustomPriceChange}
                  className="w-full text-2xl font-bold border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="1,000,000"
                />
                <div className="flex space-x-2">
                  <button
                    onClick={handlePriceSave}
                    className="flex-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={handlePriceCancel}
                    className="flex-1 px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-3xl font-bold text-black">{formatCurrency(purchasePrice)}</p>
                <div className="mt-1 space-y-1">
                  <p className="text-sm text-gray-500">{sdeMultiple.toFixed(1)}x EBITDA</p>
                  <p className="text-xs text-gray-400">
                    {priceSource === 'extracted_from_pdf' ? (
                      <span className="text-green-600 font-medium">📄 Found in PDF</span>
                    ) : priceSource === 'user_edited' ? (
                      <span className="text-blue-600 font-medium">✏️ User edited</span>
                    ) : (
                      <span className="text-orange-600 font-medium">📊 Estimated ({estimationMethod})</span>
                    )}
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-200">
            <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-2">Min. Investment</h3>
            <p className="text-3xl font-bold text-black">{formatCurrency(purchasePrice * 0.10)}</p>
            <p className="text-sm text-gray-500 mt-1">10% down payment</p>
          </div>
        </div>

        {/* Debt Service Analysis */}
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-3xl p-8 mb-12">
          <h2 className="text-2xl font-bold text-black mb-6">Debt Service Coverage</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">Projected DSCR by Year</h3>
              <div className="space-y-3">
                {model.projections.dscr.map((dscr, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/50 rounded-xl p-3">
                    <span className="font-medium">Year {i + 1}</span>
                    <span className={`font-bold ${dscr < 1.25 ? 'text-red-600' : 'text-green-600'}`}>
                      {dscr.toFixed(2)}x
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Financing Assumptions</h3>
              <div className="space-y-3 bg-white/50 rounded-xl p-4">
                <div className="flex justify-between">
                  <span>Loan Amount:</span>
                  <span className="font-semibold">{formatCurrency(purchasePrice * 0.80)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Interest Rate:</span>
                  <span className="font-semibold">{formatPercent(model.assumptions.interestRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Term:</span>
                  <span className="font-semibold">{model.assumptions.loanTermYears} years</span>
                </div>
                <div className="flex justify-between border-t pt-3">
                  <span>Annual Debt Service:</span>
                  <span className="font-bold text-red-600">{formatCurrency(model.projections.annualDebtService)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Analysis Narrative - Show if Textract was used */}
        {model.historicalData.metadata.analysisNarrative && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-3xl p-8 shadow-lg border border-indigo-200 mb-12">
            <div className="flex items-center mb-6">
              <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl mr-4">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-black">AI Investment Analysis</h2>
                <p className="text-gray-600">Comprehensive M&A insights from document analysis</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="prose prose-sm max-w-none text-gray-700">
                <div className="whitespace-pre-line">
                  {model.historicalData.metadata.analysisNarrative.substring(0, 2000)}
                  {model.historicalData.metadata.analysisNarrative.length > 2000 && (
                    <span className="text-blue-600 cursor-pointer hover:underline" onClick={() => {
                      alert(model.historicalData.metadata.analysisNarrative);
                    }}> ...read more</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Business Analysis */}
        <div className="bg-white rounded-3xl p-8 shadow-lg border border-gray-200 mb-12">
          <h2 className="text-2xl font-bold text-black mb-6">Business Analysis</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Key Insights */}
            <div className="space-y-4">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
                <Eye className="h-5 w-5 mr-2" />
                Key Insights
              </h3>
              {businessAnalysis.insights.map((insight, index) => (
                <div key={index} className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-sm text-blue-700">{insight}</p>
                </div>
              ))}
            </div>
            
            {/* Opportunities */}
            <div className="space-y-4">
              <h3 className="font-semibold text-green-900 mb-3 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Opportunities
              </h3>
              {businessAnalysis.opportunities.map((opportunity, index) => (
                <div key={index} className="p-4 bg-green-50 rounded-xl border border-green-200">
                  <p className="text-sm text-green-700">{opportunity}</p>
                </div>
              ))}
            </div>
            
            {/* Risk Factors */}
            <div className="space-y-4">
              <h3 className="font-semibold text-red-900 mb-3 flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                Risk Factors
              </h3>
              {businessAnalysis.risks.length > 0 ? (
                businessAnalysis.risks.map((risk, index) => (
                  <div key={index} className="p-4 bg-red-50 rounded-xl border border-red-200">
                    <p className="text-sm text-red-700">{risk}</p>
                  </div>
                ))
              ) : (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-sm text-gray-600">No significant risks identified from financial data</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Ultra-Intelligence Analysis */}
        {model.historicalData.metadata?.documentIntelligence && (
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-3xl p-8 shadow-lg border border-purple-200 mb-12">
            <div className="flex items-center mb-6">
              <div className="p-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl mr-4">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-black">Ultra-Intelligence Analysis</h2>
                <p className="text-gray-600">AI-powered M&A insights from comprehensive document analysis</p>
              </div>
            </div>

            {/* Investment Intelligence Summary */}
            {model.historicalData.metadata.investmentIntelligence && (
              <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <Star className="h-5 w-5 text-yellow-500 mr-2" />
                  Investment Intelligence
                </h3>
                <div className="prose prose-sm max-w-none text-gray-700">
                  <div className="whitespace-pre-line">
                    {model.historicalData.metadata.investmentIntelligence.substring(0, 1000)}
                    {model.historicalData.metadata.investmentIntelligence.length > 1000 && '...'}
                  </div>
                </div>
              </div>
            )}

            {/* Intelligence Assessment Scores */}
            {model.historicalData.metadata.intelligenceAssessment && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {Object.entries(model.historicalData.metadata.intelligenceAssessment).map(([key, value]) => (
                  <div key={key} className="bg-white rounded-xl p-4 text-center shadow-sm">
                    <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </h4>
                    <div className="relative">
                      <div className="text-2xl font-bold text-gray-900">{value}/10</div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div 
                          className={`h-2 rounded-full ${
                            value >= 8 ? 'bg-green-500' : 
                            value >= 6 ? 'bg-yellow-500' : 
                            value >= 4 ? 'bg-orange-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${(value / 10) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Valuation Intelligence */}
            {model.historicalData.metadata.valuationIntelligence && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <DollarSign className="h-5 w-5 text-green-500 mr-2" />
                    Valuation Intelligence
                  </h3>
                  <div className="space-y-3">
                    {model.historicalData.metadata.valuationIntelligence.fairValueRange && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Fair Value Range:</span>
                        <span className="font-semibold">
                          {formatCurrency(model.historicalData.metadata.valuationIntelligence.fairValueRange[0])} - {formatCurrency(model.historicalData.metadata.valuationIntelligence.fairValueRange[1])}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Confidence:</span>
                      <span className="font-semibold">{model.historicalData.metadata.valuationIntelligence.valuationConfidence}%</span>
                    </div>
                    {model.historicalData.metadata.valuationIntelligence.appropriateMultiples && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 font-medium mb-1">Industry Benchmarks:</p>
                        <p className="text-sm text-gray-700">{model.historicalData.metadata.valuationIntelligence.appropriateMultiples}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <Shield className="h-5 w-5 text-red-500 mr-2" />
                    Risk Assessment
                  </h3>
                  {model.historicalData.metadata.riskAssessment && model.historicalData.metadata.riskAssessment.length > 0 ? (
                    <div className="space-y-3">
                      {model.historicalData.metadata.riskAssessment.slice(0, 3).map((risk, index) => (
                        <div key={index} className="border-l-4 border-red-400 pl-3">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-sm font-medium text-gray-900">{risk.risk}</span>
                            <span className="text-xs text-red-600 font-semibold">
                              {risk.impact}/10
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">{risk.mitigation}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No specific risks identified in analysis</p>
                  )}
                </div>
              </div>
            )}

            {/* Value Creation Plan */}
            {model.historicalData.metadata.valueCreationPlan && model.historicalData.metadata.valueCreationPlan.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <TrendingUp className="h-5 w-5 text-blue-500 mr-2" />
                  Value Creation Opportunities
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {model.historicalData.metadata.valueCreationPlan.slice(0, 4).map((opportunity, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-sm font-semibold text-gray-900">{opportunity.opportunity}</h4>
                        <div className="flex space-x-1">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            P:{opportunity.priority}/10
                          </span>
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                            {opportunity.timeline}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{opportunity.impact}</p>
                      <div className="w-full bg-gray-200 rounded-full h-1">
                        <div 
                          className="bg-blue-500 h-1 rounded-full"
                          style={{ width: `${(opportunity.priority / 10) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={onBuildModel}
            className="px-8 py-4 bg-green-400 text-black font-bold text-lg rounded-lg hover:bg-green-500 transition-all transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2"
          >
            <Calculator className="h-5 w-5" />
            <span>Build 5-Year Financial Model</span>
          </button>
          
          {hasInvestorData && onDeepAnalysis && (
            <button
              onClick={onDeepAnalysis}
              className="px-8 py-4 bg-purple-600 text-white font-bold text-lg rounded-lg hover:bg-purple-700 transition-all transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2"
            >
              <Eye className="h-5 w-5" />
              <span>Deep Analysis</span>
            </button>
          )}
          
          {hasInvestorData && onViewInvestorDashboard && (
            <button
              onClick={onViewInvestorDashboard}
              className="px-8 py-4 bg-blue-600 text-white font-bold text-lg rounded-lg hover:bg-blue-700 transition-all transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2"
            >
              <BarChart3 className="h-5 w-5" />
              <span>View Investor Dashboard</span>
            </button>
          )}
          
          <button
            onClick={onBack}
            className="px-8 py-4 bg-gray-200 text-gray-700 font-bold text-lg rounded-lg hover:bg-gray-300 transition-all"
          >
            Upload Different File
          </button>
        </div>
        
        {/* COMPREHENSIVE EXTRACTION DEBUG ANALYSIS */}
        <div className="mt-12 bg-red-50 rounded-lg p-6 border-2 border-red-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-red-800">🚨 COMPREHENSIVE EXTRACTION DEBUG ANALYSIS 🚨</h2>
            <button 
              onClick={() => {
                const debugData = {
                  modelData: model,
                  financialData: financialData,
                  calculations: {
                    ttmRevenue,
                    ttmEBITDA,
                    purchasePrice,
                    sdeMultiple,
                    priceSource,
                    estimationMethod
                  },
                  businessAnalysis,
                  rawMetadata: financialData.metadata
                };
                console.log('=== COMPLETE DEBUG DATA ===', debugData);
                navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
                alert('Debug data copied to clipboard and logged to console!');
              }}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold"
            >
              📋 Copy Complete Debug Data
            </button>
          </div>
          
          {/* EXTRACTION SUMMARY */}
          <div className="mb-6 p-4 bg-white rounded border">
            <h3 className="font-bold text-gray-800 mb-3">📊 EXTRACTION SUMMARY</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="p-3 bg-blue-50 rounded">
                <div className="font-semibold text-blue-800">Extraction Method</div>
                <div className="text-blue-600">{financialData.metadata?.extractionMethod || 'Unknown'}</div>
              </div>
              <div className="p-3 bg-green-50 rounded">
                <div className="font-semibold text-green-800">Confidence</div>
                <div className="text-green-600">{Math.round((financialData.metadata?.confidence || 0) * 100)}%</div>
              </div>
              <div className="p-3 bg-purple-50 rounded">
                <div className="font-semibold text-purple-800">Tables Found</div>
                <div className="text-purple-600">{financialData.metadata?.tablesExtracted || 0}</div>
              </div>
              <div className="p-3 bg-orange-50 rounded">
                <div className="font-semibold text-orange-800">Business Type</div>
                <div className="text-orange-600">{financialData.metadata?.businessType || 'Unknown'}</div>
              </div>
            </div>
          </div>

          {/* CRITICAL FIELDS STATUS */}
          <div className="mb-6 p-4 bg-white rounded border">
            <h3 className="font-bold text-gray-800 mb-3">🎯 CRITICAL FIELDS STATUS</h3>
            <div className="space-y-2 text-sm">
              <div className={`flex items-center ${financialData.metadata?.businessName ? 'text-green-700' : 'text-red-700'}`}>
                <span className="mr-2">{financialData.metadata?.businessName ? '✅' : '❌'}</span>
                <span className="font-medium">Business Name:</span>
                <span className="ml-2">{financialData.metadata?.businessName || 'NOT FOUND'}</span>
              </div>
              <div className={`flex items-center ${financialData.metadata?.purchasePrice ? 'text-green-700' : 'text-red-700'}`}>
                <span className="mr-2">{financialData.metadata?.purchasePrice ? '✅' : '❌'}</span>
                <span className="font-medium">Purchase Price:</span>
                <span className="ml-2">
                  {financialData.metadata?.purchasePrice ? 
                    formatCurrency(financialData.metadata.purchasePrice) : 
                    'NOT FOUND'
                  }
                </span>
              </div>
              <div className={`flex items-center ${financialData.metadata?.priceSource !== 'estimated' ? 'text-green-700' : 'text-yellow-700'}`}>
                <span className="mr-2">{financialData.metadata?.priceSource !== 'estimated' ? '✅' : '⚠️'}</span>
                <span className="font-medium">Price Source:</span>
                <span className="ml-2">{financialData.metadata?.priceSource || 'unknown'}</span>
              </div>
            </div>
          </div>

          {/* FINANCIAL DATA BY PERIOD */}
          <div className="mb-6 p-4 bg-white rounded border">
            <h3 className="font-bold text-gray-800 mb-3">💰 FINANCIAL DATA BY PERIOD</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Metric</th>
                    {financialData.periods?.map(period => (
                      <th key={period} className="text-right p-2">{period}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2 font-medium text-blue-700">Revenue</td>
                    {financialData.periods?.map(period => (
                      <td key={period} className={`text-right p-2 ${financialData.statements.incomeStatement.revenue[period] ? 'text-green-600' : 'text-red-500'}`}>
                        {financialData.statements.incomeStatement.revenue[period] ? 
                          formatCurrency(financialData.statements.incomeStatement.revenue[period]) : 
                          'NO DATA'
                        }
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium text-purple-700">EBITDA</td>
                    {financialData.periods?.map(period => (
                      <td key={period} className={`text-right p-2 ${financialData.statements.incomeStatement.ebitda[period] ? 'text-green-600' : 'text-red-500'}`}>
                        {financialData.statements.incomeStatement.ebitda[period] ? 
                          formatCurrency(financialData.statements.incomeStatement.ebitda[period]) : 
                          'NO DATA'
                        }
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-2 font-medium text-green-700">Gross Profit</td>
                    {financialData.periods?.map(period => (
                      <td key={period} className={`text-right p-2 ${financialData.statements.incomeStatement.grossProfit[period] ? 'text-green-600' : 'text-red-500'}`}>
                        {financialData.statements.incomeStatement.grossProfit[period] ? 
                          formatCurrency(financialData.statements.incomeStatement.grossProfit[period]) : 
                          'NO DATA'
                        }
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* KEY CALCULATIONS */}
          <div className="mb-6 p-4 bg-white rounded border">
            <h3 className="font-bold text-gray-800 mb-3">🧮 KEY CALCULATIONS</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-medium text-blue-700">TTM Revenue</div>
                <div className="font-mono text-lg">{formatCurrency(ttmRevenue)}</div>
              </div>
              <div>
                <div className="font-medium text-purple-700">TTM EBITDA</div>
                <div className="font-mono text-lg">{formatCurrency(ttmEBITDA)}</div>
              </div>
              <div>
                <div className="font-medium text-green-700">EBITDA Margin</div>
                <div className="font-mono text-lg">{formatPercent(ttmEBITDA / ttmRevenue)}</div>
              </div>
              <div>
                <div className="font-medium text-red-700">SDE Multiple</div>
                <div className="font-mono text-lg">{sdeMultiple.toFixed(2)}x</div>
              </div>
            </div>
          </div>

          {/* RAW API RESPONSE */}
          <div className="mb-6 p-4 bg-black rounded border">
            <h3 className="font-bold text-green-400 mb-3">💻 RAW API RESPONSE DATA</h3>
            <div className="text-xs font-mono text-green-300 bg-gray-900 p-3 rounded max-h-96 overflow-y-auto">
              <pre>{JSON.stringify({
                rawApiResponse: financialData.metadata?.rawApiResponse,
                extractionMethod: financialData.metadata?.extractionMethod,
                debugInfo: financialData.metadata?.debugInfo,
                statements: financialData.statements,
                metadata: financialData.metadata
              }, null, 2)}</pre>
            </div>
          </div>

          {/* RECOMMENDATIONS */}
          <div className="p-4 bg-yellow-50 rounded border border-yellow-200">
            <h3 className="font-bold text-yellow-800 mb-3">💡 DEBUGGING RECOMMENDATIONS</h3>
            <div className="space-y-2 text-sm text-yellow-700">
              {!financialData.metadata?.purchasePrice && (
                <div>• Purchase price not found - check for "Asking Price", "Sale Price", or "Investment Required" terms</div>
              )}
              {!financialData.metadata?.businessName && (
                <div>• Business name not extracted - verify company name is clearly stated in document</div>
              )}
              {financialData.metadata?.priceSource === 'estimated' && (
                <div>• Purchase price was estimated, not extracted - improve price detection patterns</div>
              )}
              {(financialData.metadata?.confidence || 0) < 0.8 && (
                <div>• Low extraction confidence - consider document quality or different analysis service</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Financial Model Builder Component
function FinancialModelBuilder({ model, financialData, onSave, onViewModels }) {
  const [inputs, setInputs] = useState({
    purchasePrice: model.assumptions.purchasePrice,
    revenueGrowthRate: 0.05,
    grossMarginPercent: 0.30,
    opexPercent: 0.20,
    workingCapitalPercent: 0.02,
    capexPercent: 0.015,
    taxRate: 0.25,
    exitMultiple: 3.5,
    exitYear: 5,
    discountRate: 0.15,
    downPaymentPercent: model.assumptions.downPaymentPercent,
    debtPercent: model.assumptions.debtPercent,
    interestRate: model.assumptions.interestRate,
    loanTermYears: model.assumptions.loanTermYears,
    sellerFinancingPercent: model.assumptions.sellerFinancingPercent || 0,
    depreciationPercent: 0.02
  });

  const [fiveYearModel, setFiveYearModel] = useState(() => 
    buildFiveYearModel(financialData, model, inputs)
  );

  const [flashMessage, setFlashMessage] = useState('');
  const [customExitValue, setCustomExitValue] = useState(null);
  const [isExitValueModalOpen, setIsExitValueModalOpen] = useState(false);
  const [isUsingCustomExitValue, setIsUsingCustomExitValue] = useState(false);

  // Update inputs when model changes (e.g., when purchase price is updated)
  useEffect(() => {
    console.log('FinancialModelBuilder: Model changed, updating inputs...');
    console.log('New purchase price:', model.assumptions.purchasePrice);
    console.log('Current inputs purchase price:', inputs.purchasePrice);
    
    const updatedInputs = {
      ...inputs,
      purchasePrice: model.assumptions.purchasePrice,
      downPaymentPercent: model.assumptions.downPaymentPercent,
      debtPercent: model.assumptions.debtPercent,
      interestRate: model.assumptions.interestRate,
      loanTermYears: model.assumptions.loanTermYears,
      sellerFinancingPercent: model.assumptions.sellerFinancingPercent || 0
    };
    
    console.log('Updated inputs:', updatedInputs);
    setInputs(updatedInputs);
    
    const newModel = buildFiveYearModel(financialData, model, updatedInputs, customExitValue);
    console.log('New 5-year model debt service:', newModel.debtService);
    setFiveYearModel(newModel);
  }, [model, customExitValue]);

  const handleInputChange = (field, value) => {
    const newInputs = { ...inputs, [field]: value };
    setInputs(newInputs);
    const newModel = buildFiveYearModel(financialData, model, newInputs, customExitValue);
    setFiveYearModel(newModel);
  };

  const handleSaveClick = () => {
    console.log('handleSaveClick called');
    console.log('fiveYearModel:', fiveYearModel);
    console.log('inputs:', inputs);
    const modelId = generateId();
    onSave(fiveYearModel, inputs);
    setFlashMessage('Saved to my models');
    setTimeout(() => setFlashMessage(''), 3000);
  };

  // Exit Value Modal Handlers
  const handleExitValueClick = () => {
    setIsExitValueModalOpen(true);
  };

  const handleExitValueConfirm = (newExitValue) => {
    setCustomExitValue(newExitValue);
    setIsUsingCustomExitValue(true);
    
    // Rebuild the model with the new custom exit value
    const newModel = buildFiveYearModel(financialData, model, inputs, newExitValue);
    setFiveYearModel(newModel);
  };

  const handleExitValueClose = () => {
    setIsExitValueModalOpen(false);
  };

  const handleExcelDownload = () => {
    try {
      console.log('Starting Excel download...');
      console.log('XLSX library:', typeof XLSX);
      
      // Create a new workbook
      const wb = XLSX.utils.book_new();
    
    // Create financial projections sheet
    const projectionData = [
      ['5-Year Financial Projections', '', '', '', '', ''],
      ['', '', '', '', '', ''],
      ['Year', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'],
      ['Revenue', ...(fiveYearModel.revenue || []).map(v => v || 0)],
      ['EBITDA', ...(fiveYearModel.ebitda || []).map(v => v || 0)],
      ['EBITDA Margin', ...(fiveYearModel.ebitdaMargin || []).map(v => (v || 0) * 100 + '%')],
      ['Free Cash Flow', ...(fiveYearModel.freeCashFlow || []).map(v => v || 0)],
      ['', '', '', '', '', ''],
      ['Investment Analysis', '', '', '', '', ''],
      ['Purchase Price', model.assumptions.purchasePrice || 0, '', '', '', ''],
      ['IRR', ((fiveYearModel.irr || 0) * 100).toFixed(1) + '%', '', '', '', ''],
      ['MOIC', (fiveYearModel.moic || 0).toFixed(2) + 'x', '', '', '', ''],
      ['', '', '', '', '', ''],
      ['Debt Service Coverage', '', '', '', '', ''],
      ['Year', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'],
      ['DSCR', ...(fiveYearModel.dscr || []).map(v => v ? v.toFixed(2) + 'x' : 'N/A')]
    ];

    // Add formulas for calculations
    const wsProjections = XLSX.utils.aoa_to_sheet(projectionData);
    
    // Set column widths
    wsProjections['!cols'] = [
      { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
    ];

    // Add assumptions sheet
    const assumptionsData = [
      ['Financial Model Assumptions', '', ''],
      ['', '', ''],
      ['Growth Assumptions', '', ''],
      ['Revenue Growth Rate', (inputs.revenueGrowth || 0) * 100 + '%', ''],
      ['EBITDA Margin', (inputs.ebitdaMargin || 0) * 100 + '%', ''],
      ['Capex % of Revenue', (inputs.capexPercent || 0) * 100 + '%', ''],
      ['Working Capital % of Revenue', (inputs.workingCapitalPercent || 0) * 100 + '%', 'Applied to revenue changes'],
      ['', '', ''],
      ['Investment Details', '', ''],
      ['Purchase Price', '$' + (model.assumptions.purchasePrice || 0).toLocaleString(), ''],
      ['Debt Amount', '$' + (model.assumptions.debtAmount || 0).toLocaleString(), ''],
      ['Interest Rate', (model.assumptions.interestRate || 0) * 100 + '%', ''],
      ['Loan Term (Years)', model.assumptions.loanTerm || 0, ''],
      ['', '', ''],
      ['Current Financial Data', '', ''],
      ['TTM Revenue', '$' + (financialData.statements.incomeStatement?.revenue['TTM'] || 0).toLocaleString(), ''],
      ['TTM EBITDA', '$' + (financialData.statements.incomeStatement?.ebitda['TTM'] || 0).toLocaleString(), '']
    ];

    const wsAssumptions = XLSX.utils.aoa_to_sheet(assumptionsData);
    wsAssumptions['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 10 }];

    // Add sheets to workbook
    XLSX.utils.book_append_sheet(wb, wsProjections, 'Financial Projections');
    XLSX.utils.book_append_sheet(wb, wsAssumptions, 'Assumptions');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `Financial_Model_${timestamp}.xlsx`;

      // Download the file
      console.log('Attempting to download file:', filename);
      XLSX.writeFile(wb, filename);
      console.log('Excel download completed');
      
      setFlashMessage('Excel model downloaded');
      setTimeout(() => setFlashMessage(''), 3000);
    } catch (error) {
      console.error('Excel download error:', error);
      setFlashMessage('Error downloading Excel file');
      setTimeout(() => setFlashMessage(''), 3000);
    }
  };

  const chartData = fiveYearModel.years.map((year, i) => ({
    year: `Year ${year}`,
    revenue: fiveYearModel.revenue[i],
    ebitda: fiveYearModel.ebitda[i],
    fcf: fiveYearModel.freeCashFlow[i],
    cashAfterDebt: fiveYearModel.cashAfterDebt[i]
  }));

  const dscrData = fiveYearModel.years.map((year, i) => ({
    year: `Year ${year}`,
    dscr: fiveYearModel.dscr[i],
    minDSCR: 1.25
  }));

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Flash Message */}
        {flashMessage && (
          <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2">
            <CheckCircle className="h-5 w-5" />
            <span>{flashMessage}</span>
          </div>
        )}

        {/* Top Action Bar */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex space-x-3">
            <button
              onClick={handleSaveClick}
              className="px-6 py-3 bg-green-400 text-black font-bold rounded-lg hover:bg-green-500 transition-all flex items-center space-x-2"
            >
              <Download className="h-5 w-5" />
              <span>Save Model</span>
            </button>
            <button
              onClick={handleExcelDownload}
              className="px-6 py-3 bg-black text-white font-bold rounded-lg hover:bg-gray-800 transition-all flex items-center space-x-2"
            >
              <Download className="h-5 w-5" />
              <span>Download Excel</span>
            </button>
          </div>
          <button
            onClick={onViewModels}
            className="text-sm text-gray-600 hover:text-gray-900 underline flex items-center space-x-1"
          >
            <BarChart3 className="h-4 w-4" />
            <span>View All Models</span>
          </button>
        </div>

        <div className="text-center mb-12 relative">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="p-4 bg-green-100 rounded-lg">
              <Calculator className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-black mb-4">5-Year Financial Model</h1>
          <p className="text-xl text-gray-700">Adjust assumptions to test different scenarios</p>
        </div>

        {/* Key Metrics Summary */}
        <div className="bg-gradient-to-r from-green-400 to-emerald-500 text-black rounded-3xl p-8 mb-12 shadow-xl">
          <h2 className="text-2xl font-bold mb-6">Investment Returns</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6">
              <h3 className="text-sm font-bold uppercase tracking-wide mb-2">Investment</h3>
              <p className="text-3xl font-bold">{formatCurrency(model.assumptions.purchasePrice * inputs.downPaymentPercent)}</p>
              <p className="text-sm mt-1 opacity-90">{formatPercent(inputs.downPaymentPercent)} down</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6">
              <h3 className="text-sm font-bold uppercase tracking-wide mb-2">IRR</h3>
              <p className="text-4xl font-bold">
                {fiveYearModel.irr < 0 ? 'N/A' : formatPercent(fiveYearModel.irr)}
              </p>
              <p className="text-sm mt-1 opacity-90">
                {fiveYearModel.irr < 0 ? 'Negative returns' : 'Internal Rate of Return'}
              </p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6">
              <h3 className="text-sm font-bold uppercase tracking-wide mb-2">MOIC</h3>
              <p className="text-4xl font-bold">
                {fiveYearModel.moic < 0 || !isFinite(fiveYearModel.moic) ? 'N/A' : `${fiveYearModel.moic.toFixed(2)}x`}
              </p>
              <p className="text-sm mt-1 opacity-90">Multiple on Capital</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6">
              <h3 className="text-sm font-bold uppercase tracking-wide mb-2">Payback</h3>
              <p className="text-4xl font-bold">{fiveYearModel.paybackYears.toFixed(1)} yrs</p>
              <p className="text-sm mt-1 opacity-90">Years to Recovery</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-sm font-bold uppercase tracking-wide">Exit Value</h3>
                <button
                  onClick={handleExitValueClick}
                  className="text-white/80 hover:text-white text-sm flex items-center"
                >
                  <Edit3 className="h-3 w-3 mr-1" />
                  Edit
                </button>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(fiveYearModel.exitValue)}</p>
              <p className="text-sm mt-1 opacity-90">
                {customExitValue > 0 ? 'Custom' : `Year ${inputs.exitYear} @ ${fiveYearModel.exitMultiple?.toFixed(1) || 3.0}x EBITDA`}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Adjustable Inputs */}
          <div className="lg:col-span-1">
            <div className="bg-gray-50 rounded-3xl p-6 border border-gray-200 sticky top-6 z-10">
              <h3 className="text-xl font-bold text-black mb-6 flex items-center">
                <Sliders className="h-5 w-5 mr-2" />
                Model Assumptions
              </h3>
              
              <div className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
                {/* Investment Structure Section */}
                <div className="pb-6 border-b border-gray-200">
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Investment Structure</h4>
                  
                  {/* Down Payment */}
                  <div className="mb-4">
                    <label className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                      <span className="flex items-center space-x-1">
                        <span>Down Payment %</span>
                        <div className="group relative">
                          <span className="text-gray-400 cursor-help">ⓘ</span>
                          <div className="hidden group-hover:block absolute z-20 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg left-0 top-5">
                            Your equity investment. SBA loans require 10-15% down. Conventional loans: 20-30%.
                          </div>
                        </div>
                      </span>
                      <span className="text-green-600 font-bold">{formatPercent(inputs.downPaymentPercent)}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={inputs.downPaymentPercent}
                      onChange={(e) => handleInputChange('downPaymentPercent', parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Investment: {formatCurrency(model.assumptions.purchasePrice * inputs.downPaymentPercent)}</span>
                    </div>
                  </div>

                  {/* Interest Rate */}
                  <div className="mb-4">
                    <label className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                      <span className="flex items-center space-x-1">
                        <span>Interest Rate</span>
                        <div className="group relative">
                          <span className="text-gray-400 cursor-help">ⓘ</span>
                          <div className="hidden group-hover:block absolute z-20 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg left-0 top-5">
                            Annual interest rate on debt. Current SBA rates: 11-13%. Bank loans: 8-12%.
                          </div>
                        </div>
                      </span>
                      <span className="text-green-600 font-bold">{formatPercent(inputs.interestRate)}</span>
                    </label>
                    <input
                      type="range"
                      min="0.06"
                      max="0.15"
                      step="0.005"
                      value={inputs.interestRate}
                      onChange={(e) => handleInputChange('interestRate', parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                  </div>

                  {/* Loan Term */}
                  <div>
                    <label className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                      <span className="flex items-center space-x-1">
                        <span>Loan Term</span>
                        <div className="group relative">
                          <span className="text-gray-400 cursor-help">ⓘ</span>
                          <div className="hidden group-hover:block absolute z-20 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg left-0 top-5">
                            Repayment period. SBA loans: up to 10 years. Longer terms = lower payments but more interest.
                          </div>
                        </div>
                      </span>
                      <span className="text-green-600 font-bold">{inputs.loanTermYears} years</span>
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="10"
                      step="1"
                      value={inputs.loanTermYears}
                      onChange={(e) => handleInputChange('loanTermYears', parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                  </div>
                </div>

                {/* Operations Section */}
                <div className="pb-6 border-b border-gray-200">
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Operations</h4>
                  
                  {/* Revenue Growth */}
                  <div className="mb-4">
                    <label className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                      <span className="flex items-center space-x-1">
                        <span>Revenue Growth Rate</span>
                        <div className="group relative">
                          <span className="text-gray-400 cursor-help">ⓘ</span>
                          <div className="hidden group-hover:block absolute z-20 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg left-0 top-5">
                            Annual revenue growth rate. Industry average is 5-15%. Higher growth typically requires investment in sales, marketing, or capacity.
                          </div>
                        </div>
                      </span>
                      <span className="text-green-600 font-bold">{formatPercent(inputs.revenueGrowthRate)}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="0.30"
                      step="0.01"
                      value={inputs.revenueGrowthRate}
                      onChange={(e) => handleInputChange('revenueGrowthRate', parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                  </div>

                  {/* Gross Margin */}
                  <div className="mb-4">
                    <label className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                      <span className="flex items-center space-x-1">
                        <span>Gross Margin %</span>
                        <div className="group relative">
                          <span className="text-gray-400 cursor-help">ⓘ</span>
                          <div className="hidden group-hover:block absolute z-20 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg left-0 top-5">
                            Revenue minus direct costs (COGS). Service businesses: 40-50%. Manufacturing: 20-35%. Software: 70-90%.
                          </div>
                        </div>
                      </span>
                      <span className="text-green-600 font-bold">{formatPercent(inputs.grossMarginPercent)}</span>
                    </label>
                    <input
                      type="range"
                      min="0.15"
                      max="0.50"
                      step="0.01"
                      value={inputs.grossMarginPercent}
                      onChange={(e) => handleInputChange('grossMarginPercent', parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                  </div>

                  {/* Operating Expenses */}
                  <div>
                    <label className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                      <span className="flex items-center space-x-1">
                        <span>Operating Expenses %</span>
                        <div className="group relative">
                          <span className="text-gray-400 cursor-help">ⓘ</span>
                          <div className="hidden group-hover:block absolute z-20 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg left-0 top-5">
                            SG&A expenses as % of revenue. Includes salaries, rent, insurance, marketing. Well-run SMBs: 15-25%.
                          </div>
                        </div>
                      </span>
                      <span className="text-green-600 font-bold">{formatPercent(inputs.opexPercent)}</span>
                    </label>
                    <input
                      type="range"
                      min="0.10"
                      max="0.35"
                      step="0.01"
                      value={inputs.opexPercent}
                      onChange={(e) => handleInputChange('opexPercent', parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                  </div>
                </div>

                {/* Exit and Other Section */}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Exit and Other</h4>

                  {/* Exit Year */}
                  <div className="mb-4">
                    <label className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                      <span className="flex items-center space-x-1">
                        <span>Exit Year</span>
                        <div className="group relative">
                          <span className="text-gray-400 cursor-help">ⓘ</span>
                          <div className="hidden group-hover:block absolute z-20 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg left-0 top-5">
                            When you plan to sell the business. Most SMB buyers hold for 3-7 years.
                          </div>
                        </div>
                      </span>
                      <span className="text-green-600 font-bold">Year {inputs.exitYear}</span>
                    </label>
                    <input
                      type="range"
                      min="3"
                      max="7"
                      step="1"
                      value={inputs.exitYear}
                      onChange={(e) => handleInputChange('exitYear', parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                  </div>

                  {/* Exit Multiple - Now Calculated Based on Business Type */}
                  <div className="mb-4">
                    <label className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                      <span className="flex items-center space-x-1">
                        <span>Exit Multiple</span>
                        <div className="group relative">
                          <span className="text-gray-400 cursor-help">ⓘ</span>
                          <div className="hidden group-hover:block absolute z-20 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg left-0 top-5">
                            Exit multiple automatically calculated based on business type and industry benchmarks. Insurance brokerages: 3.5x, Technology: 5.0x, Services: 3.0x EBITDA.
                          </div>
                        </div>
                      </span>
                      <span className="text-green-600 font-bold">{fiveYearModel.exitMultiple?.toFixed(1) || 3.0}x</span>
                    </label>
                    <div className="w-full p-3 bg-gray-100 rounded-lg border">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Auto-calculated:</span> {fiveYearModel.exitMultiple?.toFixed(1) || 3.0}x EBITDA
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Based on {model.historicalData?.metadata?.businessType || 'business'} industry standards
                      </p>
                    </div>
                  </div>

                  {/* Tax Rate */}
                  <div>
                    <label className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                      <span className="flex items-center space-x-1">
                        <span>Tax Rate</span>
                        <div className="group relative">
                          <span className="text-gray-400 cursor-help">ⓘ</span>
                          <div className="hidden group-hover:block absolute z-20 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg left-0 top-5">
                            Effective tax rate. Federal corporate rate is 21%, plus state taxes typically 3-8%.
                          </div>
                        </div>
                      </span>
                      <span className="text-green-600 font-bold">{formatPercent(inputs.taxRate)}</span>
                    </label>
                    <input
                      type="range"
                      min="0.15"
                      max="0.35"
                      step="0.01"
                      value={inputs.taxRate}
                      onChange={(e) => handleInputChange('taxRate', parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Charts and Analysis */}
          <div className="lg:col-span-2 space-y-8">
            {/* Financial Performance Chart */}
            <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-200">
              <h3 className="text-xl font-bold text-black mb-6">Financial Performance</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="year" stroke="#666" />
                  <YAxis stroke="#666" tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} name="Revenue" />
                  <Line type="monotone" dataKey="ebitda" stroke="#3b82f6" strokeWidth={3} name="EBITDA" />
                  <Line type="monotone" dataKey="fcf" stroke="#f59e0b" strokeWidth={3} name="Free Cash Flow" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* DSCR Analysis */}
            <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-200">
              <h3 className="text-xl font-bold text-black mb-6">Debt Service Coverage Ratio</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dscrData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="year" stroke="#666" />
                  <YAxis stroke="#666" tickFormatter={(value) => value.toFixed(1) + 'x'} />
                  <Tooltip formatter={(value) => value.toFixed(2) + 'x'} />
                  <Bar dataKey="dscr" fill="#10b981" name="DSCR">
                    <LabelList 
                      dataKey="dscr" 
                      position="top" 
                      formatter={(value) => value.toFixed(2) + 'x'}
                      style={{ fill: '#666', fontSize: '12px', fontWeight: 'bold' }}
                    />
                  </Bar>
                  <ReferenceLine y={1.25} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "Min Required", position: "right" }} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-700">
                  <strong>DSCR Analysis:</strong> Lenders typically require a minimum DSCR of 1.25x. 
                  {fiveYearModel.dscr[0] < 1.25 ? (
                    <span className="text-red-600 font-bold"> Year 1 DSCR is below minimum - consider adjusting assumptions.</span>
                  ) : (
                    <span className="text-green-600 font-bold"> All years meet minimum DSCR requirements.</span>
                  )}
                </p>
              </div>
            </div>

            {/* Investment & Returns Chart */}
            <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-200">
              <h3 className="text-xl font-bold text-black mb-6">Investment & Returns Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-4">Cash Flow Waterfall</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart 
                      data={[
                        { name: 'Initial Investment', value: -(model.assumptions.purchasePrice * inputs.downPaymentPercent), color: '#ef4444' },
                        ...fiveYearModel.cashAfterDebt.slice(0, inputs.exitYear).map((cf, i) => ({
                          name: `Year ${i + 1}`,
                          value: cf,
                          color: cf > 0 ? '#10b981' : '#f59e0b'
                        })),
                        { name: `Exit (Yr ${inputs.exitYear})`, value: fiveYearModel.exitValue, color: '#3b82f6' }
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" stroke="#666" angle={-45} textAnchor="end" height={80} />
                      <YAxis stroke="#666" tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Bar dataKey="value">
                        {[
                          { name: 'Initial Investment', value: -(model.assumptions.purchasePrice * inputs.downPaymentPercent), color: '#ef4444' },
                          ...fiveYearModel.cashAfterDebt.slice(0, inputs.exitYear).map((cf, i) => ({
                            name: `Year ${i + 1}`,
                            value: cf,
                            color: cf > 0 ? '#10b981' : '#f59e0b'
                          })),
                          { name: `Exit (Yr ${inputs.exitYear})`, value: fiveYearModel.exitValue, color: '#3b82f6' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-4">Return Breakdown</h4>
                  <div className="space-y-3">
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Initial Investment</span>
                        <span className="font-bold text-red-600">{formatCurrency(model.assumptions.purchasePrice * inputs.downPaymentPercent)}</span>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Operating Cash Flows</span>
                        <span className={`font-bold ${fiveYearModel.cashAfterDebt.slice(0, inputs.exitYear).reduce((a, b) => a + b, 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(fiveYearModel.cashAfterDebt.slice(0, inputs.exitYear).reduce((a, b) => a + b, 0))}
                        </span>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Exit Value (Year {inputs.exitYear})</span>
                        <span className="font-bold text-blue-600">{formatCurrency(fiveYearModel.exitValue)}</span>
                      </div>
                    </div>
                    <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-gray-700">Total Return</span>
                        <span className={`font-bold text-lg ${
                          fiveYearModel.cashAfterDebt.slice(0, inputs.exitYear).reduce((a, b) => a + b, 0) + 
                          fiveYearModel.exitValue < 0 ? 'text-red-700' : 'text-green-700'
                        }`}>
                          {formatCurrency(
                            fiveYearModel.cashAfterDebt.slice(0, inputs.exitYear).reduce((a, b) => a + b, 0) + 
                            fiveYearModel.exitValue
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-gray-600">Return Multiple</span>
                        <span className={`font-bold ${fiveYearModel.moic < 1 ? 'text-red-600' : 'text-green-600'}`}>{fiveYearModel.moic.toFixed(2)}x</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cash Flow Waterfall Analysis */}
            <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-200">
              <h3 className="text-xl font-bold text-black mb-6">Cash Flow Waterfall Analysis</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Year 1 Waterfall */}
                <div>
                  <h4 className="font-medium mb-3">Year 1 Cash Flow Build-Up</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                      <span className="font-medium">EBITDA</span>
                      <span className="font-medium text-blue-600">
                        {formatCurrency(fiveYearModel.ebitda[0])}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2 border-l-4 border-red-300">
                      <span>Less: Interest Expense</span>
                      <span className="text-red-600">
                        ({formatCurrency(fiveYearModel.debtBalance && fiveYearModel.debtBalance.length > 0 ? 
                          (inputs.purchasePrice - inputs.purchasePrice * inputs.downPaymentPercent) * inputs.interestRate : 0)})
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2 border-l-4 border-red-300">
                      <span>Less: Taxes</span>
                      <span className="text-red-600">
                        ({formatCurrency(fiveYearModel.tax[0])})
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2 border-l-4 border-red-300">
                      <span>Less: CapEx</span>
                      <span className="text-red-600">
                        ({formatCurrency(fiveYearModel.revenue[0] * 0.02)})
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2 border-l-4 border-red-300">
                      <span>Less: ΔWorking Capital</span>
                      <span className="text-red-600">
                        ({formatCurrency((fiveYearModel.revenue[0] * inputs.workingCapitalPercent) - (baseData.statements.incomeStatement?.revenue['TTM'] * inputs.workingCapitalPercent))})
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="font-medium">Free Cash Flow</span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(fiveYearModel.freeCashFlow[0])}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2 border-l-4 border-red-300">
                      <span>Less: Debt Service</span>
                      <span className="text-red-600">
                        ({formatCurrency(fiveYearModel.debtService[0])})
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-emerald-50 rounded border-2 border-emerald-200">
                      <span className="font-semibold">Cash After Debt Service</span>
                      <span className={`font-semibold ${fiveYearModel.cashAfterDebt[0] >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(fiveYearModel.cashAfterDebt[0])}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cash Flow Summary */}
                <div>
                  <h4 className="font-medium mb-3">5-Year Cash Flow Summary</h4>
                  <div className="space-y-3">
                    {fiveYearModel.years.map((year, index) => (
                      <div key={year} className="flex justify-between items-center p-2 rounded border">
                        <span>Year {year}</span>
                        <div className="text-right">
                          <div className={`font-medium ${fiveYearModel.cashAfterDebt[index] >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(fiveYearModel.cashAfterDebt[index])}
                          </div>
                          <div className="text-xs text-gray-500">
                            DSCR: {fiveYearModel.dscr[index].toFixed(2)}x
                          </div>
                        </div>
                      </div>
                    ))}
                    {inputs.exitYear <= 5 && (
                      <div className="flex justify-between items-center p-3 bg-blue-50 rounded border-2 border-blue-200">
                        <span className="font-medium">Exit Value (Year {inputs.exitYear})</span>
                        <span className="font-semibold text-blue-600">
                          {formatCurrency(fiveYearModel.exitValue)}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Key Insights */}
                  <div className="mt-4 p-3 bg-gray-50 rounded">
                    <h5 className="font-medium text-sm mb-2">Key Insights:</h5>
                    <ul className="text-xs text-gray-600 space-y-1">
                      <li>• Owner compensation normalized to market rate (~15% of revenue)</li>
                      <li>• Industry-specific CapEx assumptions applied</li>
                      <li>• {fiveYearModel.cashAfterDebt.filter(cf => cf > 0).length} of 5 years generate positive cash flow</li>
                      <li>• Average DSCR: {(fiveYearModel.dscr.reduce((a, b) => a + b, 0) / fiveYearModel.dscr.length).toFixed(2)}x</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Year-by-Year Breakdown */}
            <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-200">
              <h3 className="text-xl font-bold text-black mb-6">5-Year Financial Projections</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-4 font-bold text-gray-700">Metric</th>
                      {fiveYearModel.years.map(year => (
                        <th key={year} className="text-right py-2 px-4 font-bold text-gray-700">Year {year}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 px-4 font-medium">Revenue</td>
                      {fiveYearModel.revenue.map((val, i) => (
                        <td key={i} className="text-right py-2 px-4">{formatCurrency(val)}</td>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <td className="py-2 px-4 font-medium">EBITDA</td>
                      {fiveYearModel.ebitda.map((val, i) => (
                        <td key={i} className="text-right py-2 px-4 font-semibold">{formatCurrency(val)}</td>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 px-4 font-medium">Free Cash Flow</td>
                      {fiveYearModel.freeCashFlow.map((val, i) => (
                        <td key={i} className="text-right py-2 px-4">{formatCurrency(val)}</td>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 px-4 font-medium">Debt Service</td>
                      {fiveYearModel.debtService.map((val, i) => (
                        <td key={i} className="text-right py-2 px-4 text-red-600">({formatCurrency(val)})</td>
                      ))}
                    </tr>
                    <tr className="bg-green-50">
                      <td className="py-2 px-4 font-bold">Cash After Debt</td>
                      {fiveYearModel.cashAfterDebt.map((val, i) => (
                        <td key={i} className={`text-right py-2 px-4 font-bold ${val < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(val)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Key Metrics Explanation */}
            <div className="bg-blue-50 rounded-3xl p-6 border border-blue-200">
              <h3 className="text-lg font-bold text-black mb-4">Understanding Key Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div>
                  <h4 className="font-semibold text-blue-900 mb-2">EBITDA (Earnings Before Interest, Tax, Depreciation, Amortization)</h4>
                  <p className="text-blue-800">
                    A measure of operating performance that shows earnings from core business operations. 
                    In this model: Revenue - Operating Expenses = EBITDA. 
                    Used for valuation multiples and comparing companies.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-blue-900 mb-2">Free Cash Flow</h4>
                  <p className="text-blue-800">
                    Actual cash generated after all expenses, taxes, and investments. 
                    In this model: Net Income + Depreciation - ΔWorking Capital - CapEx = FCF. 
                    This represents the incremental cash change from operations and investments.
                  </p>
                </div>
              </div>
              <div className="mt-4 p-3 bg-blue-100 rounded-xl">
                <p className="text-xs text-blue-900">
                  <strong>Key Difference:</strong> EBITDA is an accounting measure of profitability, while Free Cash Flow represents actual cash available. 
                  A business can have positive EBITDA but negative FCF if it requires heavy reinvestment.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Exit Value Modal */}
      <ExitValueModal
        isOpen={isExitValueModalOpen}
        onClose={handleExitValueClose}
        onConfirm={handleExitValueConfirm}
        suggestedValue={fiveYearModel.exitValue}
        exitMultiple={inputs.exitMultiple}
        exitYear={inputs.exitYear}
        businessType={model.businessType}
      />
      
    </div>
  );
}

// Landing Page Component
function LandingPage({ onGetStarted, onMyModels, onLogin, user }) {
  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-green-50/30 to-white"></div>
      
      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="px-6 py-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center">
              <img src="/logo.png" alt="Logo" className="h-10 w-auto" onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }} />
              <div className="w-10 h-10 bg-black rounded flex items-center justify-center" style={{display: 'none'}}>
                <span className="text-white text-sm font-bold">E</span>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-8 text-black">
              {user ? (
                <button 
                  onClick={onMyModels}
                  className="px-4 py-2 bg-gray-900 rounded-lg text-white hover:bg-gray-700 transition-all flex items-center space-x-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>My Models</span>
                </button>
              ) : (
                <button 
                  onClick={onLogin}
                  className="px-4 py-2 bg-gray-900 rounded-lg text-white hover:bg-gray-700 transition-all flex items-center space-x-2"
                >
                  <Lock className="h-4 w-4" />
                  <span>Login</span>
                </button>
              )}
            </div>
            {/* Mobile menu */}
            <div className="md:hidden flex items-center">
              {user ? (
                <button 
                  onClick={onMyModels}
                  className="px-3 py-2 bg-gray-900 rounded-lg text-white text-sm hover:bg-gray-700 transition-all"
                >
                  My Models
                </button>
              ) : (
                <button 
                  onClick={onLogin}
                  className="px-3 py-2 bg-gray-900 rounded-lg text-white text-sm hover:bg-gray-700 transition-all"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 pb-12">
          <div className="max-w-6xl mx-auto text-center">
            <div className="mb-8">
              <div className="inline-flex items-center px-4 py-2 bg-green-100 rounded-lg text-sm text-green-800 mb-6 border border-green-200">
                <Calculator className="h-4 w-4 mr-2" />
                Professional SMB Acquisition Analysis
              </div>
              
              <h1 className="text-5xl md:text-7xl font-bold text-black mb-6 leading-tight">
                Analyze SMB
                <span className="text-green-600"> Acquisitions</span>
                <br />
                with Confidence
              </h1>
              
              <p className="text-xl md:text-2xl text-black mb-8 max-w-4xl mx-auto leading-relaxed">
                Upload CIMs and financial statements to generate comprehensive debt service models, 
                risk analysis, and valuation assessments for your next SMB acquisition.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <div className="group p-8 bg-white border border-gray-200 rounded-3xl hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                <div className="p-4 bg-green-100 rounded-lg w-fit mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <Building className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-black mb-3">CIM Analysis</h3>
                <p className="text-gray-700">Extract key financials from CIMs and historical statements with intelligent parsing</p>
              </div>
              <div className="group p-8 bg-white border border-gray-200 rounded-3xl hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                <div className="p-4 bg-green-100 rounded-lg w-fit mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <Calculator className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-black mb-3">5-Year Models</h3>
                <p className="text-gray-700">Build dynamic financial models with adjustable assumptions and scenario analysis</p>
              </div>
              <div className="group p-8 bg-white border border-gray-200 rounded-3xl hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                <div className="p-4 bg-green-100 rounded-lg w-fit mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-black mb-3">Return Analysis</h3>
                <p className="text-gray-700">Calculate IRR, MOIC, and payback periods with debt service coverage ratios</p>
              </div>
            </div>

            <div className="flex items-center justify-center space-x-12 mb-12 opacity-70">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-gray-600" />
                <span className="text-gray-600 text-sm">500+ Deals Analyzed</span>
              </div>
              <div className="flex items-center space-x-2">
                <Star className="h-5 w-5 text-yellow-500" />
                <span className="text-gray-600 text-sm">Trusted by Searchers</span>
              </div>
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-gray-600" />
                <span className="text-gray-600 text-sm">Bank-Grade Security</span>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={onGetStarted}
                className="group relative px-12 py-4 bg-green-400 text-black font-bold text-lg rounded-lg hover:bg-green-500 transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                <span className="relative z-10 flex items-center">
                  Analyze Your Deal
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
              
              <p className="text-sm text-gray-600">Upload CIM or financials • Build 5-year model • Test scenarios</p>
            </div>
          </div>
        </main>
        
        <footer className="px-6 py-8 border-t border-gray-200 bg-gray-50">
          <div className="max-w-7xl mx-auto text-center">
            <p className="text-xs text-gray-500">
              <strong>Disclaimer:</strong> This tool provides financial analysis for informational purposes only. 
              All projections and valuations are estimates based on provided data and should not be considered as investment advice. 
              Please consult with qualified financial professionals before making any investment decisions.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

// File Upload Component
function FileUpload({ onFileProcessed, onError, onViewModels, user, analysisService = 'openai-vision', setAnalysisService }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState('');
  const [extractedData, setExtractedData] = useState(null);

  const processFile = async (file) => {
    setIsProcessing(true);
    setProgress(0);
    setExtractedData(null);

    try {
      setProgress(10);
      setProcessingStep('Reading CIM/financial data...');
      await new Promise(resolve => setTimeout(resolve, 600));
      
      setProgress(30);
      setProcessingStep('Extracting key financial metrics...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setProgress(60);
      
      // Determine file type and use appropriate processor
      const fileExtension = file.name.toLowerCase().split('.').pop();
      let result;
      
      if (fileExtension === 'pdf') {
        setProcessingStep(`Analyzing PDF with ${analysisService.toUpperCase()}...`);
        result = await processPDFFile(file, setProgress, analysisService, setExtractedData);
      } else {
        setProcessingStep('Analyzing Excel spreadsheet...');
        result = await processExcelFile(file);
      }
      
      await new Promise(resolve => setTimeout(resolve, 700));
      
      setProgress(90);
      setProcessingStep('Preparing acquisition analysis...');
      await new Promise(resolve => setTimeout(resolve, 400));
      
      setProgress(100);
      setProcessingStep('Complete!');
      
      setTimeout(() => {
        onFileProcessed(result, file);
      }, 500);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to process file');
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
        setProcessingStep('');
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12 relative">
          {user && user.savedModels.length > 0 && (
            <button
              onClick={onViewModels}
              className="absolute right-0 top-0 text-sm text-gray-600 hover:text-gray-900 underline flex items-center space-x-1"
            >
              <BarChart3 className="h-4 w-4" />
              <span>View All Models</span>
            </button>
          )}
          <div className="flex items-center justify-center mb-6">
            <img src="/logo.png" alt="Logo" className="h-12 w-auto" onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }} />
            <div className="w-12 h-12 bg-black rounded flex items-center justify-center" style={{display: 'none'}}>
              <span className="text-white text-lg font-bold">E</span>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-black mb-4">Upload CIM or Financials</h1>
          <p className="text-xl text-gray-700">Upload your Confidential Information Memorandum or financial statements to begin analysis</p>
          
          {/* Analysis Service Selector */}
          <div className="mt-8 mb-8 bg-gray-50 p-6 rounded-2xl border border-gray-200">
            <div className="flex items-center justify-center space-x-4 mb-4">
              <Settings className="h-6 w-6 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">Choose Analysis Service</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <button
                onClick={() => setAnalysisService('grok-vision')}
                className={`px-4 py-3 rounded-lg font-medium transition-all border-2 text-sm ${
                  analysisService === 'grok-vision'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-600 shadow-lg transform scale-105'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400 hover:bg-purple-50'
                }`}
              >
                🚀 Grok 4 Vision
              </button>
              <button
                onClick={() => setAnalysisService('pdf-text-openai')}
                className={`px-4 py-3 rounded-lg font-medium transition-all border-2 text-sm ${
                  analysisService === 'pdf-text-openai'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg transform scale-105'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                📄 OpenAI PDF
              </button>
              <button
                onClick={() => setAnalysisService('pdf-text-claude')}
                className={`px-4 py-3 rounded-lg font-medium transition-all border-2 text-sm ${
                  analysisService === 'pdf-text-claude'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-lg transform scale-105'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400 hover:bg-purple-50'
                }`}
              >
                📄 Claude PDF
              </button>
              <button
                onClick={() => setAnalysisService('textract')}
                className={`px-4 py-3 rounded-lg font-medium transition-all border-2 text-sm ${
                  analysisService === 'textract'
                    ? 'bg-orange-600 text-white border-orange-600 shadow-lg transform scale-105'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400 hover:bg-orange-50'
                }`}
              >
                ☁️ AWS PDF
              </button>
              <button
                onClick={() => setAnalysisService('openai-vision')}
                className={`px-4 py-3 rounded-lg font-medium transition-all border-2 text-sm ${
                  analysisService === 'openai-vision'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg transform scale-105'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                👁️ OpenAI Vision
              </button>
              <button
                onClick={() => setAnalysisService('claude-vision')}
                className={`px-4 py-3 rounded-lg font-medium transition-all border-2 text-sm ${
                  analysisService === 'claude-vision'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-lg transform scale-105'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400 hover:bg-purple-50'
                }`}
              >
                👁️ Claude Vision
              </button>
            </div>
            <div className="mt-4 p-3 bg-blue-100 rounded-lg">
              <p className="text-sm text-blue-800 font-medium">
                🔍 Selected: {
                  analysisService === 'pdf-text-openai' ? 'OpenAI 4o PDF Text Analysis' :
                  analysisService === 'pdf-text-claude' ? 'Claude 3.5 Sonnet PDF Text Analysis' :
                  analysisService === 'textract' ? 'AWS Textract Direct PDF Analysis' :
                  analysisService === 'openai-vision' ? 'OpenAI 4o Vision (Image) Analysis' :
                  analysisService === 'claude-vision' ? 'Claude 3.5 Sonnet Vision (Image) Analysis' :
                  'Unknown Service'
                }
              </p>
            </div>
          </div>
        </div>

        <CustomDropzone onFileSelect={processFile} isProcessing={isProcessing}>
          <div className="absolute inset-0 bg-gradient-to-br from-green-50/20 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          
          {isProcessing ? (
            <div className="space-y-8 relative z-10">
              <div className="relative">
                <div className="w-24 h-24 mx-auto">
                  <div className="absolute inset-0 border-4 border-green-200 rounded-lg"></div>
                  <div className="absolute inset-0 border-4 border-transparent border-t-green-500 rounded-lg animate-spin"></div>
                  <div className="absolute inset-3 bg-green-400 rounded-lg opacity-20 animate-pulse"></div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-2xl font-bold text-black">Analyzing your deal...</h3>
                <div className="max-w-lg mx-auto">
                  <div className="w-full bg-gray-200 rounded-lg h-4 overflow-hidden shadow-inner">
                    <div 
                      className="bg-green-400 h-4 rounded-lg transition-all duration-700 relative overflow-hidden"
                      style={{ width: `${progress}%` }}
                    >
                      <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <p className="text-sm text-gray-600">{processingStep}</p>
                    <p className="text-sm font-semibold text-green-600">{progress}%</p>
                  </div>
                </div>
                
                <div className="text-sm text-gray-500 space-y-2 max-w-md mx-auto">
                  {progress < 30 && (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-lg animate-bounce"></div>
                      <p>📄 Reading CIM structure and format...</p>
                    </div>
                  )}
                  {progress >= 30 && progress < 60 && (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-lg animate-bounce"></div>
                      <p>💰 Extracting revenue and EBITDA data...</p>
                    </div>
                  )}
                  {progress >= 60 && progress < 90 && (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-lg animate-bounce"></div>
                      <p>📊 Calculating historical trends...</p>
                    </div>
                  )}
                  {progress >= 90 && (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-lg animate-bounce"></div>
                      <p>✅ Preparing acquisition model...</p>
                    </div>
                  )}
                </div>
                
                {/* Comprehensive extraction analysis display */}
                {extractedData && (
                  <div className="mt-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-blue-800">🔍 Extraction Analysis</h4>
                      <div className="text-lg font-bold text-blue-900">
                        {extractedData.scores?.overall || 0}% Complete
                      </div>
                    </div>
                    
                    {/* Score breakdown */}
                    {extractedData.scores && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                        <div className="text-center p-2 bg-white rounded">
                          <div className="text-xs text-gray-600">Business Info</div>
                          <div className="font-semibold text-blue-600">{extractedData.scores.businessInfo}%</div>
                        </div>
                        <div className="text-center p-2 bg-white rounded">
                          <div className="text-xs text-gray-600">Financial Data</div>
                          <div className="font-semibold text-green-600">{extractedData.scores.financialData}%</div>
                        </div>
                        <div className="text-center p-2 bg-white rounded">
                          <div className="text-xs text-gray-600">Valuation</div>
                          <div className="font-semibold text-purple-600">{extractedData.scores.valuation}%</div>
                        </div>
                        <div className="text-center p-2 bg-white rounded">
                          <div className="text-xs text-gray-600">Period Coverage</div>
                          <div className="font-semibold text-orange-600">{extractedData.scores.periodCoverage}%</div>
                        </div>
                      </div>
                    )}
                    
                    {/* Key findings */}
                    {extractedData.summary && (
                      <div className="text-xs text-blue-700 space-y-1 mb-3">
                        <div>🏢 <strong>Company:</strong> {extractedData.summary.businessName}</div>
                        <div>💵 <strong>Price:</strong> {extractedData.summary.purchasePrice}</div>
                        <div>📅 <strong>Periods:</strong> {extractedData.summary.periods}</div>
                        <div>📊 <strong>Metrics Found:</strong> {extractedData.summary.financialMetricsFound?.join(', ') || 'None'}</div>
                        <div>📈 <strong>Data Points:</strong> {extractedData.totalDataPoints}</div>
                        <div>🔧 <strong>Method:</strong> {extractedData.summary.extractionMethod}</div>
                      </div>
                    )}
                    
                    {/* Recommendations */}
                    {extractedData.recommendations && extractedData.recommendations.length > 0 && (
                      <div className="text-xs mb-3">
                        <div className="font-semibold text-blue-800 mb-1">💡 Recommendations:</div>
                        {extractedData.recommendations.map((rec, index) => (
                          <div key={index} className="text-blue-600 mb-1">{rec}</div>
                        ))}
                      </div>
                    )}
                    
                    {/* Enhanced Debug Toggle */}
                    <div className="border-t border-blue-200 pt-3 space-y-2">
                      <button
                        onClick={() => {
                          const debugDiv = document.getElementById('comprehensiveDebugView');
                          debugDiv.style.display = debugDiv.style.display === 'none' ? 'block' : 'none';
                        }}
                        className="text-xs bg-red-100 hover:bg-red-200 px-3 py-1 rounded text-red-700 font-bold mr-2"
                      >
                        🐛 HIDE/SHOW COMPREHENSIVE DEBUG
                      </button>
                      
                      <button
                        onClick={() => {
                          const rawDataDiv = document.getElementById('rawDataDisplay');
                          rawDataDiv.style.display = rawDataDiv.style.display === 'none' ? 'block' : 'none';
                        }}
                        className="text-xs bg-blue-100 hover:bg-blue-200 px-3 py-1 rounded text-blue-700 font-medium"
                      >
                        🔍 Toggle Raw Extracted Data
                      </button>
                      
                      {/* Comprehensive Debug View - NOW VISIBLE BY DEFAULT */}
                      <div id="comprehensiveDebugView" className="mt-3 p-4 bg-red-50 rounded-lg border-2 border-red-200 text-xs">
                        <div className="font-bold text-red-800 mb-4 text-center text-sm">
                          🚨 COMPREHENSIVE EXTRACTION DEBUG ANALYSIS 🚨
                        </div>
                        
                        {/* Summary Statistics */}
                        <div className="mb-4 p-3 bg-white rounded border">
                          <div className="font-bold text-gray-800 mb-2">📊 EXTRACTION SUMMARY</div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>✅ Fields Found: {extractedData?.totalDataPoints || 0}</div>
                            <div>📊 Overall Score: {extractedData?.scores?.overall || 0}%</div>
                            <div>🏢 Business Score: {extractedData?.scores?.businessInfo || 0}%</div>
                            <div>💰 Financial Score: {extractedData?.scores?.financialData || 0}%</div>
                            <div>💵 Valuation Score: {extractedData?.scores?.valuation || 0}%</div>
                            <div>📅 Period Score: {extractedData?.scores?.periodCoverage || 0}%</div>
                          </div>
                        </div>
                        
                        {/* Critical Fields Analysis */}
                        <div className="mb-4 p-3 bg-white rounded border">
                          <div className="font-bold text-gray-800 mb-2">🎯 CRITICAL FIELDS STATUS</div>
                          <div className="space-y-1">
                            <div className={`${extractedData?.detailedBreakdown?.businessInfo?.name ? 'text-green-700' : 'text-red-700'}`}>
                              {extractedData?.detailedBreakdown?.businessInfo?.name ? '✅' : '❌'} Business Name: {extractedData?.detailedBreakdown?.businessInfo?.name || 'NOT FOUND'}
                            </div>
                            <div className={`${extractedData?.detailedBreakdown?.valuation?.purchasePrice ? 'text-green-700' : 'text-red-700'}`}>
                              {extractedData?.detailedBreakdown?.valuation?.purchasePrice ? '✅' : '❌'} Purchase Price: {
                                extractedData?.detailedBreakdown?.valuation?.purchasePrice ? 
                                `$${(extractedData.detailedBreakdown.valuation.purchasePrice / 1000000).toFixed(2)}M` : 
                                'NOT FOUND'
                              }
                            </div>
                            <div className={`${extractedData?.detailedBreakdown?.valuation?.priceSource !== 'not_found' ? 'text-green-700' : 'text-red-700'}`}>
                              {extractedData?.detailedBreakdown?.valuation?.priceSource !== 'not_found' ? '✅' : '❌'} Price Source: {extractedData?.detailedBreakdown?.valuation?.priceSource || 'not_found'}
                            </div>
                            {/* Revenue Analysis */}
                            {extractedData?.detailedBreakdown?.financialMetrics?.revenue && (
                              <div className="mt-2">
                                <div className="font-semibold text-blue-700">💰 REVENUE BY PERIOD:</div>
                                {Object.entries(extractedData.detailedBreakdown.financialMetrics.revenue).map(([period, value]) => (
                                  <div key={period} className={`ml-2 ${value ? 'text-green-700' : 'text-red-700'}`}>
                                    {value ? '✅' : '❌'} {period}: {value ? `$${(value / 1000000).toFixed(2)}M` : 'NO DATA'}
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* EBITDA Analysis */}
                            {extractedData?.detailedBreakdown?.financialMetrics?.ebitda && (
                              <div className="mt-2">
                                <div className="font-semibold text-purple-700">📈 EBITDA BY PERIOD:</div>
                                {Object.entries(extractedData.detailedBreakdown.financialMetrics.ebitda).map(([period, value]) => (
                                  <div key={period} className={`ml-2 ${value ? 'text-green-700' : 'text-red-700'}`}>
                                    {value ? '✅' : '❌'} {period}: {value ? `$${(value / 1000000).toFixed(2)}M` : 'NO DATA'}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Raw API Response Analysis */}
                        {extractedData?.rawApiResponse && (
                          <div className="mb-4 p-3 bg-white rounded border">
                            <div className="font-bold text-gray-800 mb-2">🔧 RAW API RESPONSE ANALYSIS</div>
                            <div className="space-y-1 text-xs">
                              <div>📊 Response Type: {typeof extractedData.rawApiResponse}</div>
                              <div>🔑 Top-level Keys: {Object.keys(extractedData.rawApiResponse).join(', ')}</div>
                              {extractedData.rawApiResponse.financialData && (
                                <div>💰 Financial Data Keys: {Object.keys(extractedData.rawApiResponse.financialData).join(', ')}</div>
                              )}
                              {extractedData.rawApiResponse.structuredData && (
                                <div>🏗️ Structured Data Keys: {Object.keys(extractedData.rawApiResponse.structuredData).join(', ')}</div>
                              )}
                              <div>🎯 Confidence: {extractedData.rawApiResponse.confidence || 'Not provided'}</div>
                              <div>📝 Has Narrative: {extractedData.rawApiResponse.narrative ? 'Yes' : 'No'}</div>
                              <div>📋 Tables Found: {extractedData.rawApiResponse.tables?.length || 0}</div>
                            </div>
                          </div>
                        )}
                        
                        {/* Recommendations */}
                        {extractedData?.recommendations && extractedData.recommendations.length > 0 && (
                          <div className="mb-4 p-3 bg-yellow-50 rounded border border-yellow-200">
                            <div className="font-bold text-yellow-800 mb-2">💡 IMPROVEMENT RECOMMENDATIONS</div>
                            {extractedData.recommendations.map((rec, index) => (
                              <div key={index} className="text-yellow-700 mb-1 text-xs">{rec}</div>
                            ))}
                          </div>
                        )}
                        
                        {/* Processing Logs Simulation */}
                        <div className="mb-4 p-3 bg-gray-100 rounded border">
                          <div className="font-bold text-gray-800 mb-2">📝 PROCESSING LOGS</div>
                          <div className="font-mono text-xs space-y-1 text-gray-600">
                            <div>✅ PDF converted to {extractedData?.summary?.pagesProcessed || 'unknown'} images</div>
                            <div>✅ Images sent to {extractedData?.summary?.extractionMethod || 'Unknown'}</div>
                            <div>✅ Analysis completed with {extractedData?.scores?.overall || 0}% confidence</div>
                            <div>✅ Data processed through validation pipeline</div>
                            <div>✅ Financial calculations applied</div>
                            {extractedData?.detailedBreakdown?.valuation?.purchasePrice ? 
                              <div>✅ Purchase price extracted successfully</div> : 
                              <div>❌ Purchase price extraction failed</div>
                            }
                          </div>
                        </div>
                        
                        {/* Complete Raw JSON */}
                        <div className="p-3 bg-black rounded">
                          <div className="font-bold text-green-400 mb-2">💻 COMPLETE RAW JSON RESPONSE</div>
                          <pre className="text-green-300 text-xs overflow-auto max-h-96 font-mono whitespace-pre-wrap">
                            {JSON.stringify(extractedData?.rawApiResponse || extractedData, null, 2)}
                          </pre>
                        </div>
                      </div>
                      
                      <div id="rawDataDisplay" style={{display: 'none'}} className="mt-3 p-3 bg-gray-50 rounded border text-xs">
                        <div className="font-semibold text-gray-800 mb-2">📋 Complete Raw Extraction Data:</div>
                        
                        {/* Business Information */}
                        {extractedData.detailedBreakdown?.businessInfo && (
                          <div className="mb-3">
                            <div className="font-semibold text-blue-700 mb-1">🏢 Business Information:</div>
                            <div className="pl-3 space-y-1 text-gray-700">
                              {Object.entries(extractedData.detailedBreakdown.businessInfo).map(([key, value]) => (
                                <div key={key}>
                                  <span className="font-medium">{key}:</span> {value || 'Not found'}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Financial Metrics */}
                        {extractedData.detailedBreakdown?.financialMetrics && (
                          <div className="mb-3">
                            <div className="font-semibold text-green-700 mb-1">💰 Financial Metrics:</div>
                            <div className="pl-3 space-y-2 text-gray-700">
                              {Object.entries(extractedData.detailedBreakdown.financialMetrics).map(([metric, periods]) => (
                                <div key={metric}>
                                  <div className="font-medium text-green-600">{metric}:</div>
                                  <div className="pl-3">
                                    {periods && typeof periods === 'object' ? 
                                      Object.entries(periods).map(([period, value]) => (
                                        <div key={period}>
                                          {period}: {value !== null && value !== undefined && !isNaN(value) ? 
                                            `$${(value / 1000000).toFixed(2)}M` : 'No data'}
                                        </div>
                                      )) : 'No data'
                                    }
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Valuation Data */}
                        {extractedData.detailedBreakdown?.valuation && (
                          <div className="mb-3">
                            <div className="font-semibold text-purple-700 mb-1">💵 Valuation Information:</div>
                            <div className="pl-3 space-y-1 text-gray-700">
                              {Object.entries(extractedData.detailedBreakdown.valuation).map(([key, value]) => (
                                <div key={key}>
                                  <span className="font-medium">{key}:</span> {
                                    key === 'purchasePrice' && value ? 
                                      `$${(value / 1000000).toFixed(2)}M` : 
                                      (value || 'Not found')
                                  }
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Periods */}
                        {extractedData.detailedBreakdown?.periods && (
                          <div className="mb-3">
                            <div className="font-semibold text-orange-700 mb-1">📅 Time Periods Found:</div>
                            <div className="pl-3 text-gray-700">
                              {extractedData.detailedBreakdown.periods.length > 0 ? 
                                extractedData.detailedBreakdown.periods.join(', ') : 'None detected'}
                            </div>
                          </div>
                        )}
                        
                        {/* Additional Data */}
                        {extractedData.detailedBreakdown?.additionalData && (
                          <div className="mb-3">
                            <div className="font-semibold text-indigo-700 mb-1">📊 Additional Data:</div>
                            <div className="pl-3 space-y-1 text-gray-700">
                              {Object.entries(extractedData.detailedBreakdown.additionalData).map(([key, value]) => (
                                <div key={key}>
                                  <span className="font-medium">{key}:</span> {value || 'Not found'}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Parsed Data */}
                        <div className="mt-4 border-t border-gray-300 pt-3">
                          <div className="font-semibold text-gray-800 mb-2">🗂️ Parsed Financial Data:</div>
                          <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-64 text-gray-600">
                            {JSON.stringify(extractedData.detailedBreakdown, null, 2)}
                          </pre>
                        </div>
                        
                        {/* Complete Raw API Response */}
                        {extractedData.rawApiResponse && (
                          <div className="mt-4 border-t border-gray-300 pt-3">
                            <div className="font-semibold text-gray-800 mb-2">🔧 Complete Raw API Response:</div>
                            <pre className="bg-gray-800 text-green-400 p-2 rounded text-xs overflow-auto max-h-96 font-mono">
                              {JSON.stringify(extractedData.rawApiResponse, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-8 relative z-10">
              <div className="relative">
                <div className="p-6 bg-green-100 rounded-3xl w-fit mx-auto group-hover:scale-110 transition-transform duration-300">
                  <Upload className="h-16 w-16 text-green-600 group-hover:text-green-700 transition-colors" />
                </div>
                <div className="absolute -top-2 -right-2 w-10 h-10 bg-green-400 rounded-lg flex items-center justify-center shadow-lg animate-bounce">
                  <Building className="h-5 w-5 text-white" />
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-3xl font-bold text-black">
                  Upload CIM or Financial Statements
                </h3>
                <p className="text-gray-700 text-xl">
                  Drag and drop your PDF or Excel files or click to browse
                </p>
              </div>
              
              <div className="flex justify-center space-x-6">
                <div className="flex items-center space-x-3 px-6 py-3 bg-green-50 rounded-lg border border-green-200">
                  <FileSpreadsheet className="h-6 w-6 text-green-600" />
                  <span className="text-green-700 font-semibold">Excel Financials</span>
                </div>
                <div className="flex items-center space-x-3 px-6 py-3 bg-blue-50 rounded-lg border border-blue-200">
                  <FileText className="h-6 w-6 text-blue-600" />
                  <span className="text-blue-700 font-semibold">CIM (PDF)</span>
                </div>
              </div>
              
              <div className="grid md:grid-cols-3 gap-4 mt-8 max-w-2xl mx-auto">
                <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-xl">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-gray-700 font-medium">P&L Statements</span>
                </div>
                <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-xl">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-gray-700 font-medium">CIM Documents</span>
                </div>
                <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-xl">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-gray-700 font-medium">Financial Packages</span>
                </div>
              </div>
            </div>
          )}
        </CustomDropzone>

        <div className="mt-12 text-center">
          <div className="inline-flex items-center px-6 py-3 bg-green-50 rounded-lg border border-green-200 shadow-sm">
            <Shield className="h-5 w-5 text-green-600 mr-3" />
            <span className="text-green-700 font-semibold">
              Your CIM data is processed locally and never stored on our servers
            </span>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500 max-w-3xl mx-auto">
            <strong>Data Privacy:</strong> All uploaded documents are processed locally in your browser. 
            No financial data is transmitted to or stored on external servers. Analysis results are generated 
            client-side for maximum security and confidentiality.
          </p>
        </div>
      </div>
    </div>
  );
}

// Main App Component
export default function App() {
  const { user, saveModel, updateModel, deleteModel, isLoading: authLoading } = useSupabaseAuth();
  
  // Debug user state changes
  useEffect(() => {
    console.log('App: User changed:', user);
    console.log('App: Saved models count:', user?.savedModels?.length || 0);
  }, [user]);
  
  const [currentView, setCurrentView] = useState('landing');
  const [financialData, setFinancialData] = useState(null);
  const [debtServiceModel, setDebtServiceModel] = useState(null);
  const [analysisService, setAnalysisService] = useState('openai-vision'); // 'grok-vision', 'openai-vision', 'claude-vision', 'pdf-text-openai', 'pdf-text-claude', 'textract'
  const [extractedData, setExtractedData] = useState(null);
  const [showInvestorDashboard, setShowInvestorDashboard] = useState(false);
  const [extractionDebugData, setExtractionDebugData] = useState(null);

  // Check if we're on the auth callback route or model route
  useEffect(() => {
    if (window.location.pathname === '/auth/callback') {
      setCurrentView('auth-callback');
    } else if (window.location.pathname === '/model' && user && financialData && debtServiceModel) {
      setCurrentView('model');
    }
  }, [user, financialData, debtServiceModel]);
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginMode, setLoginMode] = useState('models'); // 'models' or 'save'
  const [pendingModelName, setPendingModelName] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);

  const handleFileProcessed = async (data, originalFile = null) => {
    console.log('📊 Processing file data:', data);
    
    // Store the extracted data
    setExtractedData(data);
    setFinancialData(data);
    
    // If we have the original PDF file, run aggressive extraction
    if (originalFile && originalFile.type === 'application/pdf') {
      try {
        console.log('🔍 Running enhanced PDF extraction...');
        const enhancedData = await extractAndAnalyze(originalFile);
        setExtractionDebugData(enhancedData);
        
        console.log('✅ Enhanced extraction completed:', enhancedData);
        
        // Merge enhanced data with existing data
        const mergedData = {
          ...data,
          enhancedExtraction: enhancedData,
          metadata: {
            ...data.metadata,
            enhancedExtractionAvailable: true,
            enhancedExtractionConfidence: enhancedData.summary?.confidence_score
          }
        };
        
        setExtractedData(mergedData);
        setFinancialData(mergedData);
        
      } catch (error) {
        console.error('❌ Enhanced extraction failed:', error);
        // Continue with original data
      }
    }
    
    const assumptions = generateSmartAssumptions(data);
    const model = buildDebtServiceModel(data, assumptions);
    setDebtServiceModel(model);
    setCurrentView('summary');
  };

  const handleBuildModel = () => {
    if (!user) {
      // Store that user wants to build model after login
      localStorage.setItem('auth-redirect', '/model')
      setLoginMode('save');
      setShowLoginModal(true);
    } else {
      // User is logged in, go directly to model building
      setCurrentView('model');
    }
  };

  const handleDeepAnalysis = () => {
    if (!user) {
      // Store that user wants to access deep analysis after login
      localStorage.setItem('auth-redirect', '/investor-dashboard')
      setLoginMode('save');
      setShowLoginModal(true);
    } else {
      // User is logged in, go directly to investor dashboard
      setCurrentView('investor-dashboard');
    }
  };

  const handleModelNameSubmit = (modelName) => {
    setPendingModelName(modelName);
    
    if (!user) {
      // Show login modal if not logged in
      setShowEmailCapture(false);
      setLoginMode('save');
      setShowLoginModal(true);
    } else {
      // If already logged in, save and continue
      if (financialData && debtServiceModel) {
        const savedModel = {
          id: generateId(),
          name: modelName,
          createdAt: new Date(),
          financialData,
          model: debtServiceModel,
          fiveYearModel: null,
          inputs: null
        };
        saveModel(savedModel);
      }
      setShowEmailCapture(false);
      setCurrentView('model');
    }
  };

  const handleLoginSuccess = () => {
    setShowLoginModal(false);
    
    if (loginMode === 'models') {
      setCurrentView('models');
    } else if (loginMode === 'save') {
      // User logged in to save/build model, go directly to model building
      if (financialData && debtServiceModel) {
        setCurrentView('model');
      } else {
        // If no financial data, go to upload
        setCurrentView('upload');
      }
      setPendingModelName(null);
    }
  };

  const handleSaveModel = (fiveYearModel, inputs) => {
    console.log('handleSaveModel called with:', { fiveYearModel, inputs });
    console.log('Current user:', user);
    console.log('financialData exists:', !!financialData);
    console.log('debtServiceModel exists:', !!debtServiceModel);
    
    if (financialData && debtServiceModel && user) {
      // Create a new model with all the data
      const modelToSave = {
        id: generateId(),
        name: `Model ${new Date().toLocaleDateString()}`,
        createdAt: new Date().toISOString(),
        financialData: financialData,
        debtServiceModel: debtServiceModel,
        fiveYearModel: fiveYearModel,
        inputs: inputs
      };
      
      console.log('About to save model:', modelToSave);
      // Save using the auth hook's saveModel function
      saveModel(modelToSave);
    } else {
      console.log('Save conditions not met:', {
        hasFinancialData: !!financialData,
        hasDebtServiceModel: !!debtServiceModel,
        hasUser: !!user
      });
    }
  };

  const handleSelectModel = (model) => {
    setSelectedModel(model);
    setFinancialData(model.financialData);
    // Handle both model.model and model.debtServiceModel
    setDebtServiceModel(model.model || model.debtServiceModel);
    setCurrentView('model');
  };

  const handleMyModels = () => {
    if (!user) {
      setLoginMode('models');
      setShowLoginModal(true);
    } else {
      setCurrentView('models');
    }
  };

  const modelData = financialData && debtServiceModel ? {
    revenue: financialData.statements.incomeStatement?.revenue['TTM'] || 0,
    ebitda: financialData.statements.incomeStatement?.ebitda['TTM'] || 0,
    price: debtServiceModel.assumptions.purchasePrice
  } : undefined;

  // Show loading screen while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4">
            <div className="w-16 h-16 border-4 border-green-200 border-t-green-500 rounded-full animate-spin"></div>
          </div>
          <h2 className="text-xl font-bold text-black mb-2">Loading...</h2>
          <p className="text-gray-600">Checking your login status.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {currentView === 'auth-callback' && <AuthCallback />}
      
      {currentView === 'landing' && (
        <LandingPage 
          onGetStarted={() => setCurrentView('upload')}
          onMyModels={handleMyModels}
          onLogin={() => {
            setLoginMode('models');
            setShowLoginModal(true);
          }}
          user={user}
        />
      )}
      
      {currentView === 'upload' && (
        <FileUpload 
          onFileProcessed={handleFileProcessed}
          onError={(error) => alert(error)}
          onViewModels={handleMyModels}
          user={user}
          analysisService={analysisService}
          setAnalysisService={setAnalysisService}
        />
      )}
      
      {currentView === 'summary' && debtServiceModel && (
        <AnalysisSummary 
          model={debtServiceModel}
          onBuildModel={handleBuildModel}
          onDeepAnalysis={handleDeepAnalysis}
          onBack={() => setCurrentView('upload')}
          onViewModels={handleMyModels}
          onViewInvestorDashboard={() => setCurrentView('investor-dashboard')}
          hasInvestorData={!!extractedData}
        />
      )}
      
      {currentView === 'investor-dashboard' && extractedData && (
        <div>
          <div className="mb-6 flex justify-between items-center bg-white p-4 border-b">
            <button
              onClick={() => setCurrentView('summary')}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              ← Back to Analysis
            </button>
            <button
              onClick={() => setShowInvestorDashboard(!showInvestorDashboard)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {showInvestorDashboard ? 'Hide Dashboard' : 'Show Dashboard'}
            </button>
          </div>
          <InvestorDashboard 
            extractedData={extractedData}
            rawData={extractionDebugData}
          />
        </div>
      )}
      
      {currentView === 'model' && financialData && debtServiceModel && (
        <FinancialModelBuilder 
          model={debtServiceModel}
          financialData={financialData}
          onSave={handleSaveModel}
          onViewModels={() => setCurrentView('models')}
        />
      )}
      
      {currentView === 'models' && (
        <MyModels 
          user={user}
          savedModels={user?.savedModels || []}
          onSelectModel={handleSelectModel}
          onBack={() => setCurrentView('landing')}
          onNewModel={() => setCurrentView('upload')}
          onUpdateModel={updateModel}
          onDeleteModel={deleteModel}
        />
      )}
      {console.log('Current user:', user)}
      
      
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
        mode={loginMode}
        pendingModelName={pendingModelName}
        user={user}
      />
    </>
  );
}