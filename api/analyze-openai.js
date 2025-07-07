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
    
    const { fileData, fileName, images } = req.body;
    
    console.log('📊 Request details:', {
      fileName,
      imageCount: images?.length || 0,
      hasFileData: !!fileData,
      requestSize: JSON.stringify(req.body).length
    });
    
    // Check API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OpenAI API key not configured');
      return res.status(500).json({
        error: 'OpenAI API key not configured',
        message: 'Missing OPENAI_API_KEY environment variable'
      });
    }

    if (!images || images.length === 0) {
      console.error('❌ No images provided for analysis');
      return res.status(400).json({
        error: 'No images provided',
        message: 'OpenAI vision analysis requires document images'
      });
    }

    console.log(`📄 Analyzing document: ${fileName} with OpenAI 4o (${images.length} pages)...`);
    console.log(`📏 Total payload size: ${(JSON.stringify(req.body).length / 1024 / 1024).toFixed(2)} MB`);
    
    const analysis = await performOpenAIAnalysis(images, fileName);
    
    console.log('📊 Building response structure...');
    
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
      confidence: analysis.confidence || 85,
      // Add raw response for debugging
      rawResponse: analysis,
      debugInfo: {
        extractionMethod: 'openai-4o-vision',
        processingTime: new Date().toISOString(),
        imageCount: images.length,
        hasRawData: !!analysis
      }
    };

    console.log('✅ OpenAI 4o analysis complete');
    console.log('📊 Final result structure:', {
      hasTextractData: !!result.textractData,
      hasFinancialData: !!result.textractData.financialData,
      hasStructuredData: !!result.structuredData,
      financialDataKeys: Object.keys(result.textractData.financialData),
      structuredDataKeys: Object.keys(result.structuredData),
      confidence: result.confidence
    });
    
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
  const prompt = `You are a financial analyst specializing in business acquisitions. Analyze this document and extract key financial data.

FOCUS ON THESE CRITICAL ITEMS:
1. **PURCHASE/ASKING PRICE** (HIGHEST PRIORITY)
   Search for: "Asking Price", "Purchase Price", "Sale Price", "Investment Required", "Enterprise Value", "Transaction Value", "Business Value", "Priced at", "Listed for", "Available for"
   
2. **REVENUE by Year** 
   Look for: Total Revenue, Net Revenue, Sales, Gross Revenue, Commission Income
   
3. **EBITDA by Year**
   Look for: EBITDA, Adjusted EBITDA, Recast EBITDA, SDE (Seller's Discretionary Earnings), Cash Flow
   
4. **BUSINESS INFORMATION**
   - Company name (exact as written)
   - Industry/business type
   - Brief description

RETURN ONLY THIS JSON (no other text):
{
  "financialData": {
    "periods": [],
    "revenue": {},
    "ebitda": {},
    "grossProfit": {},
    "operatingExpenses": {},
    "netIncome": {}
  },
  "structuredData": {
    "purchasePrice": null,
    "priceSource": "not_found",
    "businessInfo": {
      "name": "",
      "type": "",
      "description": ""
    }
  },
  "tables": [],
  "narrative": "",
  "confidence": 75
}

CRITICAL RULES:
- Convert "$5.2M" to 5200000
- Convert "5.2%" to 0.052 
- Use null for missing data
- Search every page for purchase price
- Be thorough but focus on the key metrics above
- Return valid JSON only`;

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
    
    console.log('📝 Raw OpenAI response length:', contentText.length, 'characters');
    console.log('📝 Raw OpenAI response preview:', contentText.substring(0, 500) + '...');
    
    // Enhanced JSON extraction with multiple attempts
    console.log('🔍 Attempting to extract JSON from OpenAI response...');
    
    let parsed = null;
    const jsonExtractionAttempts = [
      // Attempt 1: Find complete JSON object
      () => {
        const match = contentText.match(/\{[\s\S]*\}/);
        if (match) {
          console.log('✅ JSON extraction attempt 1: Found JSON pattern');
          return JSON.parse(match[0]);
        }
        throw new Error('No JSON pattern found');
      },
      // Attempt 2: Find JSON between ```json blocks
      () => {
        const match = contentText.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) {
          console.log('✅ JSON extraction attempt 2: Found JSON in code block');
          return JSON.parse(match[1]);
        }
        throw new Error('No JSON code block found');
      },
      // Attempt 3: Find JSON between { and } with better regex
      () => {
        const startIndex = contentText.indexOf('{');
        const endIndex = contentText.lastIndexOf('}');
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
          const jsonStr = contentText.substring(startIndex, endIndex + 1);
          console.log('✅ JSON extraction attempt 3: Found JSON by indices');
          return JSON.parse(jsonStr);
        }
        throw new Error('No JSON boundaries found');
      }
    ];
    
    for (let i = 0; i < jsonExtractionAttempts.length; i++) {
      try {
        parsed = jsonExtractionAttempts[i]();
        console.log(`✅ Successfully parsed JSON on attempt ${i + 1}`);
        console.log('📊 Parsed data keys:', Object.keys(parsed));
        break;
      } catch (parseError) {
        console.warn(`⚠️ JSON extraction attempt ${i + 1} failed:`, parseError.message);
      }
    }
    
    if (!parsed) {
      console.error('❌ All JSON extraction attempts failed');
      console.log('📝 Full raw response for debugging:', contentText);
    } else {
      // Log extracted data details
      console.log('📊 Extraction success details:', {
        hasFinancialData: !!parsed.financialData,
        hasStructuredData: !!parsed.structuredData,
        hasTables: !!parsed.tables && parsed.tables.length > 0,
        hasNarrative: !!parsed.narrative,
        confidence: parsed.confidence,
        financialDataPeriods: parsed.financialData?.periods?.length || 0,
        purchasePrice: parsed.structuredData?.purchasePrice,
        businessName: parsed.structuredData?.businessInfo?.name
      });
    }
    
    if (parsed) {
      return parsed;
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