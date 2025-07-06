// Bulletproof Vision API for Financial Document Analysis
// Designed specifically for Vercel serverless environment

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

    // Create the financial extraction prompt
    const financialPrompt = `You are an expert financial analyst examining a Confidential Information Memorandum (CIM) for business acquisition. Extract ALL financial data and business information from these document images.

CRITICAL EXTRACTION REQUIREMENTS:
1. **Financial Statements**: Find income statements, P&L data, historical financials
2. **Revenue Data**: Look for Revenue, Sales, Commission Income (for insurance), Total Income
3. **Profitability Metrics**: EBITDA, Adjusted EBITDA, SDE, Net Income, Operating Income
4. **Time Periods**: Extract data for 2021, 2022, 2023, TTM, or any available years
5. **Purchase Information**: Asking price, valuation, enterprise value, investment amount
6. **Business Details**: Company name, industry type, location, description

FINANCIAL TABLE ANALYSIS:
- Years are typically column headers (2021, 2022, 2023, TTM)
- Financial metrics are row headers (Revenue, EBITDA, etc.)
- Extract the actual dollar amounts, not just labels
- Numbers may be in thousands (K), millions (M), or billions (B)
- Convert ALL amounts to actual numbers (e.g., "$2.5M" → 2500000)

REQUIRED JSON OUTPUT STRUCTURE:
{
  "purchasePrice": [number or null],
  "priceSource": "direct|calculated|estimated",
  "businessInfo": {
    "name": "[company name]",
    "type": "[business type/industry]",
    "description": "[business description]",
    "location": "[location if found]",
    "employees": [number or null]
  },
  "financialData": {
    "periods": ["2021", "2022", "2023", "TTM"],
    "revenue": {"2021": [number], "2022": [number], "2023": [number], "TTM": [number]},
    "ebitda": {"2021": [number], "2022": [number], "2023": [number], "TTM": [number]},
    "adjustedEbitda": {"2021": [number], "2022": [number], "2023": [number], "TTM": [number]},
    "sde": {"2021": [number], "2022": [number], "2023": [number], "TTM": [number]},
    "netIncome": {"2021": [number], "2022": [number], "2023": [number], "TTM": [number]},
    "costOfRevenue": {"2021": [number], "2022": [number], "2023": [number], "TTM": [number]},
    "operatingExpenses": {"2021": [number], "2022": [number], "2023": [number], "TTM": [number]}
  },
  "quickStats": {
    "revenueGrowth": "[percentage as string]",
    "ebitdaMargin": "[percentage as string]",
    "profitability": "[description]"
  },
  "confidence": [0-100 integer]
}

SPECIAL INSTRUCTIONS:
- For insurance agencies: Look for "Commission Income" or "Commission Revenue"
- For SaaS businesses: Look for "ARR", "MRR", "Subscription Revenue"
- For service businesses: May show "Service Revenue" or "Professional Fees"
- If data is missing or unclear, use null (not 0)
- Be very careful to extract actual numbers, not year labels
- Focus on the most recent and complete financial data available

Return ONLY the JSON object with no additional text or markdown formatting.`;

    // Prepare the vision API request
    const content = [
      {
        type: 'text',
        text: financialPrompt
      }
    ];

    // Add all images to the request
    images.forEach((imageBase64, index) => {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${imageBase64}`,
          detail: 'high'
        }
      });
      console.log(`📄 Added image ${index + 1} to analysis`);
    });

    console.log('🚀 Calling OpenAI GPT-4 Vision...');

    // Make the OpenAI API call
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
      return res.status(500).json({
        error: 'OpenAI API error',
        message: `OpenAI returned ${openaiResponse.status}: ${errorText}`,
        details: { status: openaiResponse.status }
      });
    }

    const result = await openaiResponse.json();
    const responseText = result.choices[0].message.content;

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
      extractionMethod: 'GPT-4 Vision Analysis',
      pageCount: images.length,
      fileName: fileName
    };

    console.log('🎉 Analysis complete');
    console.log('Extracted data:', JSON.stringify(parsedData, null, 2));

    return res.status(200).json({
      success: true,
      data: parsedData,
      metadata: {
        processingTime: Date.now(),
        imageCount: images.length,
        model: 'gpt-4o'
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