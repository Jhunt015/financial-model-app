// Hybrid PDF Analysis API - Phase 1 Emergency Solution
// Multi-modal extraction with intelligent fallbacks and circuit breaker protection

const { withCircuitBreaker, withExponentialBackoff } = require('./utils/circuitBreaker');
const { PayloadOptimizer } = require('./utils/payloadOptimization');

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
    console.log('🚀 HYBRID ANALYSIS API STARTED');
    console.log('📊 Request info:', {
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasFileData: !!req.body?.fileData,
      hasImages: !!req.body?.images,
      bodySize: JSON.stringify(req.body || {}).length
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

    const { images, fileData, fileName } = req.body;

    // Validate required data
    if (!images && !fileData) {
      return res.status(400).json({
        error: 'No data provided',
        message: 'Either images or fileData is required'
      });
    }

    console.log('📄 Processing:', fileName || 'Unknown file');

    // Strategy: Try both approaches with intelligent selection
    const extractionPlan = await createExtractionPlan(images, fileData, fileName);
    console.log('📋 Extraction plan:', extractionPlan);

    let results = [];
    let primaryResult = null;
    let fallbackResult = null;

    // Execute primary extraction method
    try {
      console.log(`🎯 Executing primary method: ${extractionPlan.primary.method}`);
      primaryResult = await executeExtraction(extractionPlan.primary, req);
      results.push({
        method: extractionPlan.primary.method,
        success: true,
        data: primaryResult.data,
        confidence: primaryResult.data?.confidence || 0,
        metadata: primaryResult.metadata
      });
    } catch (primaryError) {
      console.error(`❌ Primary method failed: ${primaryError.message}`);
      results.push({
        method: extractionPlan.primary.method,
        success: false,
        error: primaryError.message,
        confidence: 0
      });
    }

    // Execute fallback method if primary failed or has low confidence
    const primaryConfidence = primaryResult?.data?.confidence || 0;
    if (!primaryResult || primaryConfidence < 60) {
      console.log(`🔄 Executing fallback method: ${extractionPlan.fallback.method}`);
      try {
        fallbackResult = await executeExtraction(extractionPlan.fallback, req);
        results.push({
          method: extractionPlan.fallback.method,
          success: true,
          data: fallbackResult.data,
          confidence: fallbackResult.data?.confidence || 0,
          metadata: fallbackResult.metadata
        });
      } catch (fallbackError) {
        console.error(`❌ Fallback method failed: ${fallbackError.message}`);
        results.push({
          method: extractionPlan.fallback.method,
          success: false,
          error: fallbackError.message,
          confidence: 0
        });
      }
    }

    // Select best result
    const bestResult = selectBestResult(results);
    console.log('🏆 Best result:', bestResult.method, 'confidence:', bestResult.confidence);

    if (!bestResult.success) {
      return res.status(500).json({
        error: 'All extraction methods failed',
        message: 'Could not extract financial data using any method',
        attempts: results,
        extractionPlan
      });
    }

    // Enhanced response with hybrid metadata
    const enhancedData = {
      ...bestResult.data,
      hybridAnalysis: {
        extractionPlan,
        attempts: results,
        selectedMethod: bestResult.method,
        confidence: bestResult.confidence,
        analysisTimestamp: new Date().toISOString(),
        version: 'hybrid-v1.0'
      }
    };

    console.log('🎉 Hybrid analysis complete');
    console.log('📊 Final confidence:', bestResult.confidence);

    return res.status(200).json({
      success: true,
      data: enhancedData,
      metadata: {
        processingTime: Date.now(),
        extractionMethod: 'hybrid-analysis',
        primaryMethod: extractionPlan.primary.method,
        fallbackMethod: extractionPlan.fallback.method,
        selectedMethod: bestResult.method,
        confidence: bestResult.confidence,
        attemptCount: results.length,
        ...bestResult.metadata
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

// Create intelligent extraction plan
async function createExtractionPlan(images, fileData, fileName) {
  const plan = {
    primary: null,
    fallback: null,
    reasoning: ''
  };

  // Decision logic based on available data and characteristics
  if (images && images.length > 0) {
    // Check payload size to determine if vision is viable
    const payloadOptimizer = new PayloadOptimizer();
    const payloadInfo = payloadOptimizer.getPayloadInfo(images);
    
    if (payloadInfo.totalSizeMB < 20) { // Vision API can handle this
      plan.primary = {
        method: 'vision-analysis',
        endpoint: '/api/analyze-vision',
        data: { images, fileName },
        reason: 'Images available and payload size acceptable'
      };
      
      if (fileData) {
        plan.fallback = {
          method: 'text-analysis',
          endpoint: '/api/analyze-text-only',
          data: { fileData, fileName },
          reason: 'Text extraction as fallback'
        };
      }
    } else {
      // Payload too large for vision, try text first
      if (fileData) {
        plan.primary = {
          method: 'text-analysis',
          endpoint: '/api/analyze-text-only',
          data: { fileData, fileName },
          reason: 'Vision payload too large, text extraction preferred'
        };
        
        plan.fallback = {
          method: 'vision-analysis',
          endpoint: '/api/analyze-vision',
          data: { images, fileName },
          reason: 'Optimized vision analysis as fallback'
        };
      } else {
        // Only images available, but large - force optimization
        plan.primary = {
          method: 'vision-analysis',
          endpoint: '/api/analyze-vision',
          data: { images, fileName },
          reason: 'Only images available, will apply optimization'
        };
      }
    }
  } else if (fileData) {
    // Only text data available
    plan.primary = {
      method: 'text-analysis',
      endpoint: '/api/analyze-text-only',
      data: { fileData, fileName },
      reason: 'Only file data available'
    };
  } else {
    throw new Error('No valid data provided for analysis');
  }

  plan.reasoning = `Primary: ${plan.primary.reason}. Fallback: ${plan.fallback?.reason || 'None'}`;
  
  return plan;
}

// Execute extraction with circuit breaker protection
async function executeExtraction(extractionConfig, req) {
  const { method, endpoint, data } = extractionConfig;
  
  const extractionCall = async () => {
    const response = await fetch(`${req.headers.origin || 'https://analyst.ebitcommunity.com'}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${method} failed: ${response.status} - ${errorText}`);
    }

    return await response.json();
  };

  // Use circuit breaker based on method
  const circuitBreakerName = method === 'vision-analysis' ? 'visionAnalysis' : 'pdfExtraction';
  
  return await withCircuitBreaker(circuitBreakerName, extractionCall);
}

// Select best result from multiple attempts
function selectBestResult(results) {
  // Filter successful results
  const successfulResults = results.filter(r => r.success);
  
  if (successfulResults.length === 0) {
    return results[0]; // Return first failed result
  }

  // Sort by confidence score
  successfulResults.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  
  return successfulResults[0];
}

// Vercel configuration
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};