// AWS Textract Document Analysis API
// Extracts structured financial data using AWS Textract, then applies AI analysis

import AWS from 'aws-sdk';
import FinancialTableExtractor from './utils/textractExtractor.js';

// Configure AWS SDK
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const textract = new AWS.Textract();

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
    console.log('🔍 Starting Textract document analysis');
    
    // Validate environment
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.log('⚠️ AWS credentials not configured, missing:', {
        hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY
      });
      return res.status(500).json({
        error: 'AWS credentials not configured',
        message: 'Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY. Configure these in Vercel environment variables.',
        details: {
          hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
          hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
          region: process.env.AWS_REGION || 'us-east-1'
        }
      });
    }

    const { fileData, fileName, images } = req.body;

    if (!fileData && !images) {
      return res.status(400).json({
        error: 'No document provided',
        message: 'Either fileData or images is required'
      });
    }

    // Step 1: Extract structured data with Textract
    console.log('📄 Analyzing document with AWS Textract...');
    const textractData = await analyzeDocumentWithTextract(fileData, images);
    
    // Step 2: Extract financial tables
    console.log('📊 Extracting financial tables...');
    const extractor = new FinancialTableExtractor();
    const financialData = extractor.extractPnLFromTextract(textractData.Blocks);
    const allTables = extractor.extractAllFinancialTables(textractData.Blocks);
    
    // Step 3: Extract all text for context
    console.log('📝 Extracting document text...');
    const documentText = extractTextFromBlocks(textractData.Blocks);
    
    // Step 4: Apply AI intelligence analysis
    console.log('🧠 Applying AI intelligence analysis...');
    const intelligenceAnalysis = await performIntelligenceAnalysis(
      financialData,
      allTables,
      documentText,
      fileName
    );
    
    // Step 5: Combine structured data with intelligence
    const comprehensiveResult = {
      // Structured financial data from Textract
      textractData: {
        financialData,
        allTables,
        documentMetadata: {
          pageCount: textractData.DocumentMetadata?.Pages || 1,
          fileName: fileName,
          analysisTimestamp: new Date().toISOString()
        }
      },
      // AI Intelligence analysis
      intelligence: intelligenceAnalysis,
      // Combined structured format
      structuredData: combineDataSources(financialData, intelligenceAnalysis),
      // Extraction confidence
      confidence: calculateConfidence(financialData, allTables)
    };

    console.log('✅ Textract analysis complete');
    
    return res.status(200).json({
      success: true,
      data: comprehensiveResult,
      metadata: {
        extractionMethod: 'aws-textract-plus-ai',
        processingTime: Date.now(),
        tablesFound: allTables.length,
        confidence: comprehensiveResult.confidence
      }
    });

  } catch (error) {
    console.error('❌ Textract API Error:', error);
    
    return res.status(500).json({
      error: 'Document analysis failed',
      message: error.message,
      type: error.constructor.name
    });
  }
}

/**
 * Analyze document with AWS Textract
 */
async function analyzeDocumentWithTextract(fileData, images) {
  let params;
  
  if (fileData) {
    // Convert base64 to buffer
    const buffer = Buffer.from(fileData.split(',')[1], 'base64');
    
    params = {
      Document: {
        Bytes: buffer
      },
      FeatureTypes: ['TABLES', 'FORMS']
    };
  } else if (images && images.length > 0) {
    // Use first image for Textract (or combine if needed)
    const buffer = Buffer.from(images[0], 'base64');
    
    params = {
      Document: {
        Bytes: buffer
      },
      FeatureTypes: ['TABLES', 'FORMS']
    };
  }
  
  // Call Textract
  const response = await textract.analyzeDocument(params).promise();
  
  return response;
}

/**
 * Extract all text from Textract blocks
 */
function extractTextFromBlocks(blocks) {
  const lines = [];
  
  // Group blocks by page and line
  const lineBlocks = blocks.filter(block => block.BlockType === 'LINE');
  
  // Sort by page and position
  lineBlocks.sort((a, b) => {
    if (a.Page !== b.Page) return a.Page - b.Page;
    return a.Geometry.BoundingBox.Top - b.Geometry.BoundingBox.Top;
  });
  
  // Extract text
  lineBlocks.forEach(block => {
    if (block.Text) {
      lines.push(block.Text);
    }
  });
  
  return lines.join('\n');
}

/**
 * Perform AI intelligence analysis on extracted data
 */
async function performIntelligenceAnalysis(financialData, allTables, documentText, fileName) {
  const analysisPrompt = `You are an expert M&A analyst. Analyze this business based on the extracted financial data and document content.

EXTRACTED FINANCIAL DATA:
${JSON.stringify(financialData, null, 2)}

ALL TABLES FOUND:
${JSON.stringify(allTables, null, 2)}

DOCUMENT TEXT:
${documentText.substring(0, 5000)}${documentText.length > 5000 ? '...' : ''}

Provide comprehensive analysis including:
1. Business quality assessment
2. Financial performance evaluation
3. Growth trajectory and sustainability
4. Risk factors and red flags
5. Valuation considerations
6. Due diligence priorities
7. Value creation opportunities

Format your response as a detailed narrative that would help an investor make an informed decision.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert M&A analyst with 20 years of experience evaluating businesses for acquisition.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        max_tokens: 4096,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API failed: ${response.status}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;
  } catch (error) {
    console.error('AI analysis error:', error);
    return 'Unable to perform AI analysis';
  }
}

/**
 * Combine Textract data with AI analysis into structured format
 */
function combineDataSources(textractFinancials, aiAnalysis) {
  // Extract purchase price from AI analysis if available
  const priceMatch = aiAnalysis.match(/purchase price.*?(\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|M))?)/i);
  const purchasePrice = priceMatch ? parseFinancialValue(priceMatch[1]) : null;
  
  return {
    purchasePrice: purchasePrice,
    priceSource: purchasePrice ? 'ai_extracted' : 'not_found',
    businessInfo: {
      analysisNarrative: aiAnalysis
    },
    financialData: {
      periods: Object.keys(textractFinancials.years || {}),
      revenue: textractFinancials.revenue || {},
      costOfRevenue: textractFinancials.cogs || {},
      grossProfit: textractFinancials.grossProfit || {},
      operatingExpenses: textractFinancials.operatingExpenses || {},
      ebitda: textractFinancials.ebitda || {},
      netIncome: textractFinancials.netIncome || {},
      adjustments: textractFinancials.adjustments || []
    }
  };
}

/**
 * Calculate extraction confidence based on data completeness
 */
function calculateConfidence(financialData, allTables) {
  let confidence = 0;
  
  // Check for key financial metrics
  if (financialData.revenue && Object.keys(financialData.revenue).length > 0) confidence += 25;
  if (financialData.ebitda && Object.keys(financialData.ebitda).length > 0) confidence += 25;
  if (financialData.years && Object.keys(financialData.years).length > 2) confidence += 20;
  if (allTables.length > 0) confidence += 20;
  if (financialData.adjustments && financialData.adjustments.length > 0) confidence += 10;
  
  return Math.min(confidence, 95);
}

/**
 * Parse financial value from text
 */
function parseFinancialValue(text) {
  if (!text) return null;
  
  // Remove currency symbols and clean
  let cleaned = text.replace(/[$,]/g, '').trim();
  
  // Handle millions notation
  if (cleaned.toLowerCase().includes('million') || cleaned.toLowerCase().includes('m')) {
    cleaned = cleaned.replace(/\s*(million|m)/i, '');
    const number = parseFloat(cleaned);
    return isNaN(number) ? null : number * 1000000;
  }
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
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