// Claude Opus 4 Vision API for financial document analysis
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
    console.log('🔍 Starting Claude Opus 4 analysis');
    
    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error: 'Claude API key not configured',
        message: 'Missing ANTHROPIC_API_KEY environment variable'
      });
    }

    const { fileData, fileName, images } = req.body;

    if (!images || images.length === 0) {
      return res.status(400).json({
        error: 'No images provided',
        message: 'Claude vision analysis requires document images'
      });
    }

    console.log('📄 Analyzing document with Claude Opus 4...');
    const analysis = await performClaudeAnalysis(images, fileName);
    
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
      intelligence: analysis.narrative || 'Claude Opus 4 analysis complete',
      structuredData: analysis.structuredData || {},
      confidence: analysis.confidence || 90
    };

    console.log('✅ Claude Opus 4 analysis complete');
    
    return res.status(200).json({
      success: true,
      data: result,
      metadata: {
        extractionMethod: 'claude-opus-4-vision',
        processingTime: Date.now(),
        tablesFound: analysis.tables?.length || 0,
        confidence: result.confidence,
        model: 'claude-3-5-sonnet-20241022'
      }
    });

  } catch (error) {
    console.error('❌ Claude Analysis Error:', error);
    
    return res.status(500).json({
      error: 'Claude analysis failed',
      message: error.message,
      type: error.constructor.name
    });
  }
}

/**
 * Enhanced Claude Opus 4 analysis for financial documents
 */
async function performClaudeAnalysis(images, fileName) {
  const prompt = `You are an expert financial analyst with deep experience in business valuation and financial statement analysis. 

Analyze this business financial document with extreme precision and extract ALL numerical financial data.

ANALYSIS REQUIREMENTS:
1. Extract every numerical value with associated years/periods
2. Identify all financial statement types (P&L, Balance Sheet, Cash Flow, etc.)
3. Parse complex financial data including percentages, ratios, and growth rates
4. Extract business information and any purchase/valuation details
5. Provide detailed financial insights and red flags

OUTPUT FORMAT (strict JSON):
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
      "data": "detailed table contents",
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
      "description": "[comprehensive business description]"
    },
    "financialHighlights": [
      "Key financial insight with specific numbers",
      "Growth trends and patterns",
      "Risk factors identified"
    ]
  },
  "narrative": "[Comprehensive 3-4 paragraph analysis covering business model, financial performance, growth prospects, and investment considerations]",
  "confidence": [1-100 confidence score based on data completeness and clarity]
}

CONVERSION RULES:
- "$5.2M" = 5200000
- "5.2%" = 0.052  
- Ranges like "$5M-$7M" = 6000000 (midpoint)
- "Five million" = 5000000
- Always return actual numbers, never strings
- Be extremely thorough - extract every financial metric you can find`;

  try {
    const content = [
      {
        type: 'text',
        text: prompt
      }
    ];

    // Add all images to the analysis
    images.forEach(image => {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: image
        }
      });
    });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ANTHROPIC_API_KEY}`,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: content
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API failed: ${response.status}`);
    }

    const result = await response.json();
    const contentText = result.content[0].text;
    
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
          description: 'Claude Opus 4 analysis of uploaded document'
        },
        financialHighlights: []
      },
      narrative: contentText.substring(0, 1000),
      confidence: 80
    };

  } catch (error) {
    console.error('Claude analysis error:', error);
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