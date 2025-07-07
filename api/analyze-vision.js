// Bulletproof Vision API for Financial Document Analysis
// Phase 1 Enhanced: Circuit Breaker + Payload Optimization
// Designed specifically for Vercel serverless environment

const { withCircuitBreaker, withExponentialBackoff } = require('./utils/circuitBreaker');
const { PayloadOptimizer } = require('./utils/payloadOptimization');

export default async function handler(req, res) {
  // Set CORS headers first
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔥 VISION API STARTED');
    console.log('Environment check:', {
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      apiKeyLength: process.env.OPENAI_API_KEY?.length || 0,
      requestSize: JSON.stringify(req.body || {}).length
    });

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

    const { images, fileName } = req.body;

    // Validate images
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        error: 'No images provided',
        message: 'At least one image is required for vision analysis'
      });
    }

    console.log('📸 Processing', images.length, 'images for', fileName);

    // Initialize payload optimizer
    const payloadOptimizer = new PayloadOptimizer({
      targetSize: 8 * 1024 * 1024, // 8MB safe limit
      maxPages: 10,
      prioritizeQuality: true
    });

    // Check and optimize payload if needed
    let optimizedImages = images;
    let optimizationResult = null;
    
    const payloadInfo = payloadOptimizer.getPayloadInfo(images);
    console.log('📊 Payload analysis:', {
      totalSizeMB: payloadInfo.totalSizeMB.toFixed(2),
      imageCount: payloadInfo.imageCount,
      isOverLimit: payloadInfo.isOverLimit,
      targetSizeMB: (payloadInfo.targetSize / (1024 * 1024)).toFixed(2)
    });

    if (payloadInfo.isOverLimit) {
      console.log('⚠️  Payload exceeds limits, applying optimization...');
      
      try {
        optimizationResult = await payloadOptimizer.optimizeImages(images, { fileName });
        optimizedImages = optimizationResult.images;
        
        console.log('✅ Payload optimization complete:', {
          originalSizeMB: (optimizationResult.originalSize / (1024 * 1024)).toFixed(2),
          finalSizeMB: (optimizationResult.finalSize / (1024 * 1024)).toFixed(2),
          compressionRatio: (optimizationResult.compressionRatio * 100).toFixed(1) + '%',
          qualityLevel: optimizationResult.qualityLevel,
          pageCount: optimizationResult.pageCount
        });
      } catch (optimizationError) {
        console.error('❌ Payload optimization failed:', optimizationError.message);
        // Continue with original images and hope for the best
      }
    }

    // Create the comprehensive financial extraction prompt
    const financialPrompt = `You are an expert financial analyst examining a Confidential Information Memorandum (CIM) for business acquisition. This document contains extensive financial information that must be extracted comprehensively.

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
   - Convert ALL amounts to actual numbers (e.g., "$2.5M" → 2500000)

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

    // Prepare the vision API request
    const content = [
      {
        type: 'text',
        text: financialPrompt
      }
    ];

    // Add all optimized images to the request
    optimizedImages.forEach((imageBase64, index) => {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${imageBase64}`,
          detail: 'high'
        }
      });
      console.log(`📄 Added optimized image ${index + 1} to analysis`);
    });

    console.log('🚀 Calling OpenAI GPT-4 Vision with Circuit Breaker...');

    // Create fallback function for text extraction
    const textExtractionFallback = async () => {
      console.log('🔄 Attempting text extraction fallback...');
      
      const fallbackResponse = await fetch(`${req.headers.origin || 'https://analyst.ebitcommunity.com'}/api/analyze-text-only`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          fileData: req.body.fileData, // Original file data for text extraction
          fileName: fileName
        })
      });

      if (!fallbackResponse.ok) {
        throw new Error(`Text extraction fallback failed: ${fallbackResponse.status}`);
      }

      const fallbackResult = await fallbackResponse.json();
      console.log('✅ Text extraction fallback successful');
      return fallbackResult;
    };

    // OpenAI Vision API call with circuit breaker
    const visionApiCall = async () => {
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
            content: content
          }],
          max_tokens: 4096,
          temperature: 0.1
        })
      });

      console.log('OpenAI response status:', openaiResponse.status);

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error('OpenAI API error:', errorText);
        throw new Error(`OpenAI returned ${openaiResponse.status}: ${errorText}`);
      }

      return await openaiResponse.json();
    };

    // Execute with circuit breaker and fallback
    let result, responseText;
    try {
      result = await withCircuitBreaker('visionAnalysis', visionApiCall, textExtractionFallback);
      
      // Check if this is a fallback response
      if (result.success && result.data) {
        // This is from text extraction fallback
        console.log('✅ Using text extraction fallback result');
        return res.status(200).json(result);
      } else {
        // This is from vision API
        responseText = result.choices[0].message.content;
      }
    } catch (error) {
      console.error('💥 Both vision and text extraction failed:', error.message);
      
      // Last resort: try exponential backoff on vision API
      try {
        console.log('🔄 Attempting exponential backoff retry...');
        result = await withExponentialBackoff(visionApiCall, {
          context: 'vision-api-retry',
          maxRetries: 2,
          baseDelay: 2000
        });
        responseText = result.choices[0].message.content;
      } catch (retryError) {
        return res.status(500).json({
          error: 'All extraction methods failed',
          message: retryError.message,
          details: { originalError: error.message }
        });
      }
    }

    console.log('✅ OpenAI response received');
    console.log('Response length:', responseText.length);
    console.log('Usage:', result.usage);
    console.log('Full response:', responseText);

    // Parse the JSON response
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedData = JSON.parse(jsonMatch[0]);
        } catch (e) {
          return res.status(500).json({
            error: 'Failed to parse response',
            message: 'Could not extract valid JSON from OpenAI response',
            rawResponse: responseText.substring(0, 500)
          });
        }
      } else {
        return res.status(500).json({
          error: 'Invalid response format',
          message: 'OpenAI did not return valid JSON',
          rawResponse: responseText.substring(0, 500)
        });
      }
    }

    // Add metadata
    parsedData.modelInfo = {
      provider: 'OpenAI',
      model: 'gpt-4o',
      analysisTimestamp: new Date().toISOString(),
      extractionMethod: 'GPT-4 Vision Analysis Enhanced',
      pageCount: optimizedImages.length,
      originalPageCount: images.length,
      fileName: fileName,
      payloadOptimization: optimizationResult ? {
        applied: true,
        originalSizeMB: (optimizationResult.originalSize / (1024 * 1024)).toFixed(2),
        finalSizeMB: (optimizationResult.finalSize / (1024 * 1024)).toFixed(2),
        compressionRatio: optimizationResult.compressionRatio,
        qualityLevel: optimizationResult.qualityLevel
      } : {
        applied: false,
        reason: 'Payload within limits'
      }
    };

    console.log('🎉 Analysis complete');
    console.log('Extracted data:', JSON.stringify(parsedData, null, 2));

    return res.status(200).json({
      success: true,
      data: parsedData,
      metadata: {
        processingTime: Date.now(),
        imageCount: optimizedImages.length,
        originalImageCount: images.length,
        model: 'gpt-4o',
        extractionMethod: 'vision-enhanced',
        payloadOptimized: !!optimizationResult,
        circuitBreakerUsed: true,
        fallbackAvailable: true
      }
    });

  } catch (error) {
    console.error('💥 VISION API ERROR');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    return res.status(500).json({
      error: 'Vision API failed',
      message: error.message,
      type: error.constructor.name,
      timestamp: new Date().toISOString()
    });
  }
}

// Vercel configuration
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};