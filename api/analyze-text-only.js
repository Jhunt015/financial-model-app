// Bulletproof Text Extraction API - Emergency Fallback
// Multi-method text extraction with intelligent fallbacks

const pdfParse = require('pdf-parse');

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔥 TEXT EXTRACTION API STARTED');
    
    // Validate environment
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'OpenAI API key not configured',
        message: 'Environment variable OPENAI_API_KEY is missing'
      });
    }

    // Validate request body
    if (!req.body || !req.body.fileData) {
      return res.status(400).json({
        error: 'No file data provided',
        message: 'Request body must contain fileData (base64 encoded PDF)'
      });
    }

    const { fileData, fileName } = req.body;
    
    console.log('📄 Processing PDF:', fileName);
    console.log('📊 File size:', fileData.length, 'bytes');

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(fileData, 'base64');
    
    // Multi-method text extraction
    let extractedText = '';
    let extractionMethod = 'unknown';
    
    // Method 1: pdf-parse (primary)
    try {
      console.log('🔍 Attempting pdf-parse extraction...');
      const pdfData = await pdfParse(pdfBuffer);
      extractedText = pdfData.text;
      extractionMethod = 'pdf-parse';
      console.log('✅ pdf-parse successful, extracted', extractedText.length, 'characters');
    } catch (pdfParseError) {
      console.log('❌ pdf-parse failed:', pdfParseError.message);
      
      // Method 2: Manual text extraction fallback
      try {
        console.log('🔍 Attempting manual text extraction...');
        // Simple text extraction as fallback
        extractedText = await extractTextManually(pdfBuffer);
        extractionMethod = 'manual';
        console.log('✅ Manual extraction successful, extracted', extractedText.length, 'characters');
      } catch (manualError) {
        console.log('❌ Manual extraction failed:', manualError.message);
        throw new Error('All text extraction methods failed');
      }
    }

    // Validate extracted text
    if (!extractedText || extractedText.length < 50) {
      return res.status(400).json({
        error: 'Insufficient text extracted',
        message: `Only ${extractedText.length} characters extracted. PDF may be image-based.`,
        extractionMethod,
        suggestion: 'Consider using vision-based extraction for this document'
      });
    }

    console.log('📝 Text extraction complete:', extractionMethod);
    console.log('📊 Extracted text preview:', extractedText.substring(0, 200) + '...');

    // Analyze text with OpenAI using comprehensive extraction
    const financialPrompt = `You are an expert financial analyst examining a business document. Extract ALL financial data comprehensively from this text.

DOCUMENT TEXT:
${extractedText}

CRITICAL EXTRACTION MISSION: Extract ALL financial data with maximum detail and accuracy.

REQUIRED JSON OUTPUT STRUCTURE:
{
  "purchasePrice": [number or null],
  "priceSource": "extracted|estimated|not_found",
  "businessInfo": {
    "name": "[exact company name]",
    "type": "[industry/business type]",
    "description": "[detailed business description]",
    "location": "[city, state]",
    "employees": [number or null],
    "yearEstablished": [year or null]
  },
  "financialData": {
    "periods": ["2021", "2022", "2023", "TTM"],
    "revenue": {"2021": [number], "2022": [number], "2023": [number], "TTM": [number]},
    "commissionIncome": {"2021": [number], "2022": [number], "2023": [number], "TTM": [number]},
    "costOfRevenue": {"2021": [number], "2022": [number], "2023": [number], "TTM": [number]},
    "grossProfit": {"2021": [number], "2022": [number], "2023": [number], "TTM": [number]},
    "operatingExpenses": {"2021": [number], "2022": [number], "2023": [number], "TTM": [number]},
    "ebitda": {"2021": [number], "2022": [number], "2023": [number], "TTM": [number]},
    "adjustedEbitda": {"2021": [number], "2022": [number], "2023": [number], "TTM": [number]},
    "recastEbitda": {"2021": [number], "2022": [number], "2023": [number], "TTM": [number]},
    "sde": {"2021": [number], "2022": [number], "2023": [number], "TTM": [number]},
    "netIncome": {"2021": [number], "2022": [number], "2023": [number], "TTM": [number]},
    "cashFlow": {"2021": [number], "2022": [number], "2023": [number], "TTM": [number]}
  },
  "keyMetrics": {
    "customerCount": [number or null],
    "averageCustomerValue": [number or null],
    "customerRetentionRate": [number 0-1 or null],
    "recurringRevenuePercent": [number 0-1 or null],
    "grossMargin": [number 0-1 or null],
    "ebitdaMargin": [number 0-1 or null],
    "growthRate": [number or null]
  },
  "confidence": [0-100 integer],
  "extractionMethod": "text-analysis"
}

EXHAUSTIVE FINANCIAL SEARCH INSTRUCTIONS:

1. **PURCHASE PRICE HUNTING** (CRITICAL - Search for these patterns):
   DIRECT TERMS: "Asking Price", "Purchase Price", "Enterprise Value", "Transaction Value", "Sale Price", "Acquisition Price", "Investment Required", "Business Value", "Valuation", "Price", "Investment Opportunity"
   
   CONTEXTUAL PATTERNS: Look for dollar amounts near:
   - "The business is being offered for", "Priced at", "Valued at", "Available for"
   - "Total investment", "Capital required", "Acquisition cost"
   - "Multiple of EBITDA", "x EBITDA", "times EBITDA" (calculate: multiple × EBITDA)

2. **COMPREHENSIVE FINANCIAL DATA EXTRACTION**:
   INCOME STATEMENT DATA:
   - Revenue/Sales: "Total Revenue", "Gross Revenue", "Commission Income", "Service Revenue", "Total Income"
   - Expenses: "Operating Expenses", "General & Administrative", "Salaries", "Rent", "Other Expenses", "Total Expenses"
   - EBITDA Variations: "EBITDA", "Adjusted EBITDA", "Recast EBITDA", "Pro Forma EBITDA", "Seller's Discretionary Earnings", "SDE", "Owner's Cash Flow", "Distributable Cash Flow"
   - Profit Metrics: "Net Income", "Operating Income", "Pre-Tax Income", "After-Tax Income"

   SPECIAL BUSINESS TYPES:
   - Insurance Agencies: "Commission Income", "Renewal Rates", "Book of Business Value", "Client Retention", "Premium Volume"
   - Service Businesses: "Billable Hours", "Utilization Rates", "Client Fees", "Professional Services Revenue"
   - SaaS: "MRR", "ARR", "Churn Rate", "Customer Lifetime Value", "Subscription Revenue"

3. **FINANCIAL TABLE EXTRACTION**:
   - Look for tabular data with years as columns (2019, 2020, 2021, 2022, 2023, TTM, YTD)
   - Financial metrics as row headers
   - Extract actual dollar amounts, not labels
   - Convert units: "$2.5M" → 2500000, "$450K" → 450000, "$1.2B" → 1200000000

4. **KEY BUSINESS METRICS**:
   - Customer data: Number of customers, client count, retention rates, average contract value
   - Operational metrics: Growth rates, margins, efficiency ratios
   - Market position: Market share, competitive advantages

VALIDATION REQUIREMENTS:
- Use null for any data you cannot find (do NOT estimate or make up numbers)
- Ensure financial data is internally consistent
- If you find purchase price, note how it was determined
- Extract ALL available years of data, not just the most recent

CRITICAL: Search thoroughly through ALL text and extract every piece of financial data available. Do NOT settle for minimal extraction.

Return ONLY valid JSON, no additional text.`;

    console.log('🚀 Calling OpenAI for text analysis...');

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: financialPrompt
        }],
        max_tokens: 4096,
        temperature: 0.1
      })
    });

    console.log('OpenAI response status:', openaiResponse.status);

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', errorText);
      return res.status(500).json({
        error: 'OpenAI API error',
        message: `OpenAI returned ${openaiResponse.status}: ${errorText}`
      });
    }

    const result = await openaiResponse.json();
    const responseText = result.choices[0].message.content;

    console.log('✅ OpenAI analysis complete');
    console.log('📊 Response length:', responseText.length);
    console.log('🔍 Raw response:', responseText);

    // Parse JSON response
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedData = JSON.parse(jsonMatch[0]);
        } catch (e) {
          return res.status(500).json({
            error: 'Failed to parse AI response',
            message: 'Could not extract valid JSON from OpenAI response',
            rawResponse: responseText.substring(0, 1000)
          });
        }
      } else {
        return res.status(500).json({
          error: 'Invalid AI response format',
          message: 'OpenAI did not return valid JSON',
          rawResponse: responseText.substring(0, 1000)
        });
      }
    }

    // Add metadata
    parsedData.modelInfo = {
      provider: 'OpenAI',
      model: 'gpt-4o',
      analysisTimestamp: new Date().toISOString(),
      extractionMethod: 'Text Analysis',
      textLength: extractedText.length,
      fileName: fileName,
      pdfExtractionMethod: extractionMethod
    };

    console.log('🎉 Text analysis complete');
    console.log('📋 Extracted data:', JSON.stringify(parsedData, null, 2));

    return res.status(200).json({
      success: true,
      data: parsedData,
      metadata: {
        processingTime: Date.now(),
        extractionMethod: 'text-analysis',
        textLength: extractedText.length,
        model: 'gpt-4o'
      }
    });

  } catch (error) {
    console.error('💥 TEXT EXTRACTION API ERROR');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    return res.status(500).json({
      error: 'Text extraction failed',
      message: error.message,
      type: error.constructor.name,
      timestamp: new Date().toISOString()
    });
  }
}

// Manual text extraction fallback
async function extractTextManually(buffer) {
  // Simple text extraction as last resort
  const text = buffer.toString('utf8', 0, Math.min(buffer.length, 10000));
  
  // Look for readable text patterns
  const textPatterns = text.match(/[a-zA-Z0-9\s\.,\$\%\(\)\-]+/g);
  
  if (textPatterns && textPatterns.length > 0) {
    return textPatterns.join(' ');
  }
  
  throw new Error('No readable text found in PDF');
}

// Vercel configuration
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};