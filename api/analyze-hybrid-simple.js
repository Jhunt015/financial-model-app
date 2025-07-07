// Simplified Hybrid PDF Analysis API - Emergency Fix
// Multi-modal extraction without external dependencies

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
    console.log('🚀 SIMPLIFIED HYBRID API STARTED');
    
    // Validate environment
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'OpenAI API key not configured',
        message: 'Environment variable OPENAI_API_KEY is missing'
      });
    }

    // Validate request body
    if (!req.body) {
      return res.status(400).json({
        error: 'No request body',
        message: 'Request body is required'
      });
    }

    const { images, fileData, fileName } = req.body;

    // Validate required data
    if (!images && !fileData) {
      return res.status(400).json({
        error: 'No data provided',
        message: 'Either images or fileData is required'
      });
    }

    console.log('📄 Processing:', fileName || 'Unknown file');
    console.log('📊 Data available:', { hasImages: !!images, hasFileData: !!fileData });

    let primaryResult = null;
    let fallbackResult = null;
    let selectedMethod = 'unknown';

    // Strategy 1: Try vision analysis if we have images
    if (images && Array.isArray(images) && images.length > 0) {
      console.log('🎯 Attempting vision analysis...');
      try {
        primaryResult = await callVisionAPI(images, fileName);
        selectedMethod = 'vision-analysis';
        console.log('✅ Vision analysis successful');
      } catch (visionError) {
        console.error('❌ Vision analysis failed:', visionError.message);
      }
    }

    // Strategy 2: Try text analysis if vision failed or no images
    if (!primaryResult && fileData) {
      console.log('🔄 Attempting text analysis...');
      try {
        fallbackResult = await callTextAPI(fileData, fileName);
        selectedMethod = 'text-analysis';
        console.log('✅ Text analysis successful');
      } catch (textError) {
        console.error('❌ Text analysis failed:', textError.message);
      }
    }

    // Select best result
    const finalResult = primaryResult || fallbackResult;

    if (!finalResult) {
      return res.status(500).json({
        error: 'All extraction methods failed',
        message: 'Could not extract financial data using any method',
        details: {
          visionAttempted: !!images,
          textAttempted: !!fileData
        }
      });
    }

    console.log('🎉 Hybrid analysis complete using:', selectedMethod);

    return res.status(200).json({
      success: true,
      data: finalResult.data,
      metadata: {
        processingTime: Date.now(),
        extractionMethod: 'hybrid-simple',
        selectedMethod: selectedMethod,
        confidence: finalResult.data?.confidence || 50,
        ...finalResult.metadata
      }
    });

  } catch (error) {
    console.error('💥 HYBRID API ERROR');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    return res.status(500).json({
      error: 'Hybrid analysis failed',
      message: error.message,
      type: error.constructor.name,
      timestamp: new Date().toISOString()
    });
  }
}

// Call vision API directly
async function callVisionAPI(images, fileName) {
  console.log('📸 Calling vision API with', images.length, 'images');
  
  // Simple payload size check
  const totalSize = JSON.stringify(images).length;
  console.log('📊 Payload size:', (totalSize / (1024 * 1024)).toFixed(2), 'MB');
  
  if (totalSize > 10 * 1024 * 1024) { // 10MB limit
    console.log('⚠️ Payload too large, reducing images...');
    images = images.slice(0, 3); // Take only first 3 images
  }

  const financialPrompt = `You are an expert financial analyst examining a Confidential Information Memorandum (CIM) or business document. This document contains extensive financial information that must be extracted comprehensively.

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
  "confidence": [0-100 integer]
}

EXHAUSTIVE FINANCIAL SEARCH INSTRUCTIONS:

1. **PURCHASE PRICE HUNTING** (CRITICAL - Search everywhere):
   DIRECT TERMS: "Asking Price", "Purchase Price", "Enterprise Value", "Transaction Value", "Sale Price", "Acquisition Price", "Investment Required", "Business Value", "Valuation", "Price", "Investment Opportunity", "Offered for"
   
   CONTEXTUAL PATTERNS: Look for dollar amounts near:
   - "The business is being offered for", "Priced at", "Valued at", "Available for"
   - "Total investment", "Capital required", "Acquisition cost"
   - "Multiple of EBITDA", "x EBITDA", "times EBITDA" (calculate: multiple × EBITDA)
   
   DOCUMENT SECTIONS: Search these areas specifically:
   - Title page, Executive Summary (first 2 pages)
   - Investment Highlights/Overview sections
   - Financial Summary tables
   - Investment Terms/Structure sections
   - Any "Pricing" or "Valuation" headers

2. **COMPREHENSIVE FINANCIAL DATA EXTRACTION**:
   INCOME STATEMENT DATA:
   - Revenue/Sales: Look for "Total Revenue", "Gross Revenue", "Commission Income", "Service Revenue"
   - Expenses: "Operating Expenses", "General & Administrative", "Salaries", "Rent", "Other Expenses"
   - EBITDA Variations: "EBITDA", "Adjusted EBITDA", "Recast EBITDA", "Pro Forma EBITDA", "Seller's Discretionary Earnings", "SDE", "Owner's Cash Flow"
   - Profit Metrics: "Net Income", "Operating Income", "Pre-Tax Income"

   SPECIAL BUSINESS TYPES:
   - Insurance Agencies: Look for "Commission Income", "Renewal Rates", "Book of Business Value", "Client Retention"
   - Service Businesses: "Billable Hours", "Utilization Rates", "Client Fees"
   - SaaS: "MRR", "ARR", "Churn Rate", "Customer Lifetime Value"

3. **FINANCIAL TABLE ANALYSIS**:
   - Years are typically column headers (2019, 2020, 2021, 2022, 2023, TTM, YTD)
   - Financial metrics are row headers (Revenue, EBITDA, etc.)
   - Extract the actual dollar amounts, not just labels
   - Numbers may be in thousands (K), millions (M), or billions (B)
   - Convert ALL amounts to actual numbers (e.g., "$2.5M" → 2500000, "$450K" → 450000)

4. **KEY BUSINESS METRICS**:
   - Customer data: Number of customers, retention rates, average contract value
   - Operational metrics: Growth rates, margins, efficiency ratios
   - Market position: Market share, competitive advantages

VALIDATION REQUIREMENTS:
- If you find purchase price, cross-check it makes sense (reasonable multiple of revenue/EBITDA)
- Ensure financial data is internally consistent (Revenue > Expenses, etc.)
- If data seems incomplete, explicitly note what's missing
- Use null for any financial fields you cannot find (do NOT estimate or make up numbers)

CRITICAL: This document likely contains extensive financial information. Do NOT settle for minimal extraction. Search thoroughly through all pages and extract every piece of financial data available.

Return ONLY the JSON object with no additional text or markdown formatting.`;

  const content = [
    { type: 'text', text: financialPrompt }
  ];

  images.forEach(imageBase64 => {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${imageBase64}`,
        detail: 'high'
      }
    });
  });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: content
      }],
      max_tokens: 4096,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Vision API failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const responseText = result.choices[0].message.content;

  // Parse JSON response
  let parsedData;
  try {
    parsedData = JSON.parse(responseText);
  } catch (parseError) {
    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsedData = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Could not parse vision API response as JSON');
    }
  }

  return {
    data: parsedData,
    metadata: {
      model: 'gpt-4o-vision',
      imageCount: images.length
    }
  };
}

// Call text API directly  
async function callTextAPI(fileData, fileName) {
  console.log('📝 Calling text analysis...');
  
  const response = await fetch('https://analyst.ebitcommunity.com/api/analyze-text-only', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileData: fileData,
      fileName: fileName
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Text API failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Text API returned unsuccessful result');
  }

  return {
    data: result.data,
    metadata: result.metadata
  };
}

// Vercel configuration
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};