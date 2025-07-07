// OpenAI 4o Vision API for financial document analysis
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
    console.log('🔍 Starting OpenAI 4o analysis');
    
    // Check API key
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'OpenAI API key not configured',
        message: 'Missing OPENAI_API_KEY environment variable'
      });
    }

    const { fileData, fileName, images } = req.body;

    if (!images || images.length === 0) {
      return res.status(400).json({
        error: 'No images provided',
        message: 'OpenAI vision analysis requires document images'
      });
    }

    console.log(`📄 Analyzing document with OpenAI 4o (${images.length} pages)...`);
    const analysis = await performOpenAIAnalysis(images, fileName);
    
    const result = {
      textractData: {
        financialData: analysis.financialData || {},
        allTables: analysis.tables || [],
        documentMetadata: {
          pageCount: images.length,
          fileName: fileName,
          analysisTimestamp: new Date().toISOString()
        }
      },
      intelligence: analysis.narrative || 'OpenAI 4o analysis complete',
      structuredData: analysis.structuredData || {},
      confidence: analysis.confidence || 85
    };

    console.log('✅ OpenAI 4o analysis complete');
    
    return res.status(200).json({
      success: true,
      data: result,
      metadata: {
        extractionMethod: 'openai-4o-vision',
        processingTime: Date.now(),
        tablesFound: analysis.tables?.length || 0,
        confidence: result.confidence,
        model: 'gpt-4o'
      }
    });

  } catch (error) {
    console.error('❌ OpenAI Analysis Error:', error);
    
    return res.status(500).json({
      error: 'OpenAI analysis failed',
      message: error.message,
      type: error.constructor.name
    });
  }
}

/**
 * Enhanced OpenAI 4o analysis for financial documents
 */
async function performOpenAIAnalysis(images, fileName) {
  const prompt = `You are an expert financial analyst. Analyze this business financial document and extract ALL numerical data with extreme precision.

CRITICAL REQUIREMENTS:
1. Extract EVERY numerical value you can find (revenue, expenses, profits, etc.)
2. Include the year/period for each value
3. Look for patterns like "$5.2M", "$5,200,000", "5.2 million", percentages, etc.
4. Identify financial statement types (P&L, Balance Sheet, etc.)
5. Extract business information (name, type, description)
6. **PRIORITY**: Find purchase/asking prices with these exact patterns:
   - "Asking Price", "Purchase Price", "Sale Price", "Transaction Value"
   - "Listed at", "Priced at", "Offering Price", "Acquisition Price"
   - "Target Price", "Expected Sale Price", "Investment Required"
   - "Total Investment", "Business Value", "Enterprise Value"
   - Look for standalone price mentions near business summaries

REQUIRED JSON OUTPUT:
{
  "financialData": {
    "periods": ["2021", "2022", "2023", "2024", "TTM"],
    "revenue": {
      "2021": [number or null],
      "2022": [number or null], 
      "2023": [number or null],
      "2024": [number or null],
      "TTM": [number or null]
    },
    "grossProfit": {
      "2021": [number or null],
      "2022": [number or null],
      "2023": [number or null], 
      "2024": [number or null],
      "TTM": [number or null]
    },
    "ebitda": {
      "2021": [number or null],
      "2022": [number or null],
      "2023": [number or null],
      "2024": [number or null], 
      "TTM": [number or null]
    },
    "operatingExpenses": {
      "2021": [number or null],
      "2022": [number or null],
      "2023": [number or null],
      "2024": [number or null],
      "TTM": [number or null]
    },
    "netIncome": {
      "2021": [number or null],
      "2022": [number or null],
      "2023": [number or null],
      "2024": [number or null],
      "TTM": [number or null]
    }
  },
  "tables": [
    {
      "type": "P&L" | "Balance Sheet" | "Cash Flow" | "Other",
      "data": "summary of table contents",
      "years": ["2021", "2022", "2023"],
      "keyMetrics": ["revenue", "expenses", "profit"]
    }
  ],
  "structuredData": {
    "purchasePrice": [number or null],
    "priceSource": "extracted" | "estimated" | "not_found",
    "businessInfo": {
      "name": "[exact company name]",
      "type": "[business type/industry]", 
      "description": "[business description]"
    },
    "financialHighlights": [
      "Key financial insight 1",
      "Key financial insight 2"
    ]
  },
  "narrative": "[2-3 paragraph analysis of business and financial performance]",
  "confidence": [1-100 confidence score]
}

IMPORTANT CONVERSION RULES:
- "$5.2M" or "$5.2 million" = 5200000
- "5.2%" = 0.052
- Always convert to actual numbers, not strings
- If you see a range like "$5M-$7M", use the midpoint: 6000000
- Include ALL financial data you can find, even if incomplete`;

  try {
    const content = [
      { type: 'text', text: prompt }
    ];

    // Add all images to the analysis
    images.forEach(image => {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${image}`,
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
        messages: [{ role: 'user', content: content }],
        max_tokens: 4096,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API failed: ${response.status}`);
    }

    const result = await response.json();
    const contentText = result.choices[0].message.content;
    
    // Try to parse JSON from response
    try {
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed;
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.log('Raw response:', contentText);
    }

    // Fallback: return basic structure with response text
    return {
      financialData: {
        periods: ['TTM'],
        revenue: { TTM: null },
        ebitda: { TTM: null },
        grossProfit: { TTM: null },
        operatingExpenses: { TTM: null },
        netIncome: { TTM: null }
      },
      tables: [],
      structuredData: {
        purchasePrice: null,
        priceSource: 'not_found',
        businessInfo: {
          name: 'Financial Document Analysis',
          type: 'Business Analysis',
          description: 'OpenAI 4o analysis of uploaded document'
        },
        financialHighlights: []
      },
      narrative: contentText.substring(0, 1000),
      confidence: 70
    };

  } catch (error) {
    console.error('OpenAI analysis error:', error);
    throw error;
  }
}

// Vercel configuration
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
    maxDuration: 300,
  },
};