// PDF Text Extraction + AI Analysis (OpenAI/Claude with text instead of vision)
import PDFParser from 'pdf2json';

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
    console.log('🔍 Starting PDF text extraction + AI analysis');
    
    const { fileData, fileName, aiService = 'openai' } = req.body;

    if (!fileData) {
      return res.status(400).json({
        error: 'No PDF data provided',
        message: 'fileData is required for PDF text extraction'
      });
    }

    // Extract text from PDF
    console.log('📄 Extracting text from PDF...');
    const pdfText = await extractTextFromPDF(fileData);
    console.log(`📝 Extracted ${pdfText.length} characters of text`);
    
    // Analyze with selected AI service
    console.log(`🧠 Analyzing with ${aiService.toUpperCase()}...`);
    const analysis = await analyzeWithAI(pdfText, fileName, aiService);
    
    const result = {
      textractData: {
        financialData: analysis.financialData || {},
        allTables: analysis.tables || [],
        documentMetadata: {
          pageCount: 1,
          fileName: fileName,
          analysisTimestamp: new Date().toISOString(),
          textLength: pdfText.length
        }
      },
      intelligence: analysis.narrative || 'PDF text analysis complete',
      structuredData: analysis.structuredData || {},
      confidence: analysis.confidence || 85
    };

    console.log('✅ PDF text analysis complete');
    
    return res.status(200).json({
      success: true,
      data: result,
      metadata: {
        extractionMethod: `pdf-text-${aiService}`,
        processingTime: Date.now(),
        tablesFound: analysis.tables?.length || 0,
        confidence: result.confidence,
        textLength: pdfText.length
      }
    });

  } catch (error) {
    console.error('❌ PDF Text Analysis Error:', error);
    
    return res.status(500).json({
      error: 'PDF text analysis failed',
      message: error.message,
      type: error.constructor.name
    });
  }
}

/**
 * Extract text from PDF using pdf2json
 */
async function extractTextFromPDF(fileData) {
  return new Promise((resolve, reject) => {
    try {
      // Remove data URL prefix if present
      const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
      const buffer = Buffer.from(base64Data, 'base64');
      
      const pdfParser = new PDFParser();
      
      pdfParser.on('pdfParser_dataError', (errData) => {
        console.error('PDF Parse Error:', errData.parserError);
        reject(new Error(`PDF parsing failed: ${errData.parserError}`));
      });
      
      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        try {
          // Extract text from all pages
          let fullText = '';
          
          if (pdfData.Pages) {
            pdfData.Pages.forEach((page, pageIndex) => {
              if (page.Texts) {
                page.Texts.forEach(textItem => {
                  if (textItem.R) {
                    textItem.R.forEach(textRun => {
                      if (textRun.T) {
                        fullText += decodeURIComponent(textRun.T) + ' ';
                      }
                    });
                  }
                });
                fullText += '\n\n'; // Page break
              }
            });
          }
          
          resolve(fullText.trim());
        } catch (extractError) {
          reject(new Error(`Text extraction failed: ${extractError.message}`));
        }
      });
      
      // Parse the PDF buffer
      pdfParser.parseBuffer(buffer);
      
    } catch (error) {
      reject(new Error(`PDF processing failed: ${error.message}`));
    }
  });
}

/**
 * Analyze extracted text with AI service
 */
async function analyzeWithAI(text, fileName, aiService) {
  const prompt = `You are an expert financial analyst. Analyze this financial document text and extract ALL numerical data with extreme precision.

DOCUMENT TEXT:
${text.substring(0, 15000)}${text.length > 15000 ? '...[truncated]' : ''}

CRITICAL REQUIREMENTS:
1. Extract EVERY numerical value you can find (revenue, expenses, profits, etc.)
2. Include the year/period for each value
3. Look for patterns like "$5.2M", "$5,200,000", "5.2 million", percentages, etc.
4. Extract business information (name, type, description)
5. Find any purchase/asking prices mentioned

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
      "data": "summary of table contents"
    }
  ],
  "structuredData": {
    "purchasePrice": [number or null],
    "priceSource": "extracted" | "estimated" | "not_found",
    "businessInfo": {
      "name": "[exact company name]",
      "type": "[business type/industry]", 
      "description": "[business description]"
    }
  },
  "narrative": "[2-3 paragraph analysis of business and financial performance]",
  "confidence": [1-100 confidence score]
}

CONVERSION RULES:
- "$5.2M" = 5200000
- "5.2%" = 0.052
- Always convert to actual numbers
- Extract ALL financial data you can find`;

  try {
    let response;
    
    if (aiService === 'openai') {
      // Check API key
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
      }
      
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4096,
          temperature: 0.1
        })
      });
    } else if (aiService === 'claude') {
      // Check API key
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('Claude API key not configured');
      }
      
      response = await fetch('https://api.anthropic.com/v1/messages', {
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
            content: prompt
          }]
        })
      });
    } else {
      throw new Error(`Unsupported AI service: ${aiService}`);
    }

    if (!response.ok) {
      throw new Error(`${aiService} API failed: ${response.status}`);
    }

    const result = await response.json();
    let contentText;
    
    if (aiService === 'openai') {
      contentText = result.choices[0].message.content;
    } else if (aiService === 'claude') {
      contentText = result.content[0].text;
    }
    
    // Try to parse JSON from response
    try {
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
    }

    // Fallback structure
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
          name: 'Financial Document',
          type: 'Business Analysis',
          description: `${aiService} analysis of ${fileName}`
        }
      },
      narrative: contentText.substring(0, 1000),
      confidence: 75
    };

  } catch (error) {
    console.error(`${aiService} analysis error:`, error);
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