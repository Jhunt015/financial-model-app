// AWS Textract Document Analysis API
// Extracts structured financial data using AWS Textract, then applies AI analysis

import AWS from 'aws-sdk';
import FinancialTableExtractor from './utils/textractExtractor.js';

// Configure AWS SDK for Vercel environment
const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  maxRetries: 3,
  httpOptions: {
    timeout: 120000
  }
};

AWS.config.update(awsConfig);
const textract = new AWS.Textract(awsConfig);

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
    
    // Validate and log environment
    const credentialStatus = {
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyPrefix: process.env.AWS_ACCESS_KEY_ID ? process.env.AWS_ACCESS_KEY_ID.substring(0, 4) + '...' : 'missing'
    };
    
    console.log('🔧 AWS Credentials Status:', credentialStatus);
    
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.log('⚠️ AWS credentials not configured');
      return res.status(500).json({
        error: 'AWS credentials not configured',
        message: 'Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY. Configure these in Vercel environment variables.',
        details: credentialStatus
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
    let financialData = { revenue: {}, ebitda: {}, years: {} };
    let allTables = [];
    
    try {
      const extractor = new FinancialTableExtractor();
      financialData = extractor.extractPnLFromTextract(textractData.Blocks);
      allTables = extractor.extractAllFinancialTables(textractData.Blocks);
      console.log('✅ Financial extraction complete');
    } catch (extractorError) {
      console.error('❌ Financial table extraction failed:', extractorError);
      // Continue with empty data as fallback
    }
    
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
    console.error('Error details:', {
      name: error.name,
      code: error.code,
      statusCode: error.statusCode,
      message: error.message,
      stack: error.stack
    });
    
    // If it's an AWS credentials issue, return specific error
    if (error.message?.includes('credentials') || error.message?.includes('token') || error.code === 'InvalidSignatureException') {
      return res.status(500).json({
        error: 'AWS credentials not configured',
        message: `AWS authentication failed: ${error.message}`,
        type: error.constructor.name,
        awsError: error.code
      });
    }
    
    return res.status(500).json({
      error: 'Document analysis failed',
      message: error.message,
      type: error.constructor.name,
      awsError: error.code || 'Unknown',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
    const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Check size limit (10MB for Textract)
    if (buffer.length > 10 * 1024 * 1024) {
      throw new Error('Document too large for Textract (max 10MB)');
    }
    
    console.log(`📊 Processing PDF: ${buffer.length} bytes`);
    
    params = {
      Document: {
        Bytes: buffer
      },
      FeatureTypes: ['TABLES', 'FORMS']
    };
  } else if (images && images.length > 0) {
    // Use first image for Textract
    const buffer = Buffer.from(images[0], 'base64');
    
    // Check size limit
    if (buffer.length > 10 * 1024 * 1024) {
      throw new Error('Image too large for Textract (max 10MB)');
    }
    
    console.log(`📊 Processing image: ${buffer.length} bytes`);
    
    params = {
      Document: {
        Bytes: buffer
      },
      FeatureTypes: ['TABLES', 'FORMS']
    };
  }
  
  // Call Textract with error handling
  try {
    console.log('🔄 Calling AWS Textract...');
    const response = await textract.analyzeDocument(params).promise();
    console.log('✅ Textract successful, blocks found:', response.Blocks?.length || 0);
    return response;
  } catch (textractError) {
    console.error('❌ Textract API call failed:', textractError);
    throw new Error(`AWS Textract failed: ${textractError.message} (${textractError.code})`);
  }
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