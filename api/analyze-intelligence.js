// Ultra-Intelligence Financial Analysis System
// Three-stage approach: Document Intelligence → Investment Intelligence → Structured Mapping

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
    console.log('🧠 ULTRA-INTELLIGENCE ANALYSIS STARTED');
    
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

    // STAGE 1: Comprehensive Document Intelligence
    console.log('🧠 Stage 1: Document Intelligence Analysis...');
    const documentAnalysis = await performDocumentIntelligence(images, fileData, fileName);
    
    // STAGE 2: Investment Decision Intelligence  
    console.log('💡 Stage 2: Investment Decision Intelligence...');
    const investmentIntelligence = await performInvestmentIntelligence(documentAnalysis.content);
    
    // STAGE 3: Structured Data Mapping with Intelligence
    console.log('📊 Stage 3: Intelligent Structured Mapping...');
    const structuredData = await performIntelligentMapping(documentAnalysis.content, investmentIntelligence.content);

    // Combine all intelligence layers
    const comprehensiveAnalysis = {
      documentIntelligence: documentAnalysis.content,
      investmentIntelligence: investmentIntelligence.content,
      structuredData: structuredData,
      metadata: {
        processingTime: Date.now(),
        extractionMethod: 'ultra-intelligence-three-stage',
        fileName: fileName,
        analysisTimestamp: new Date().toISOString(),
        confidence: calculateOverallConfidence(documentAnalysis, investmentIntelligence, structuredData)
      }
    };

    console.log('🎉 Ultra-Intelligence analysis complete');

    return res.status(200).json({
      success: true,
      data: comprehensiveAnalysis,
      metadata: {
        processingTime: Date.now(),
        extractionMethod: 'ultra-intelligence',
        confidence: comprehensiveAnalysis.metadata.confidence,
        stages: ['document-intelligence', 'investment-intelligence', 'structured-mapping']
      }
    });

  } catch (error) {
    console.error('💥 ULTRA-INTELLIGENCE API ERROR');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    return res.status(500).json({
      error: 'Ultra-Intelligence analysis failed',
      message: error.message,
      type: error.constructor.name,
      timestamp: new Date().toISOString()
    });
  }
}

// STAGE 1: Comprehensive Document Intelligence
async function performDocumentIntelligence(images, fileData, fileName) {
  console.log('🔍 Performing comprehensive document intelligence...');
  
  const intelligencePrompt = `You are an expert business analyst with 20 years of M&A experience analyzing businesses for acquisition. You have the analytical depth of a top-tier investment banker combined with the operational insight of a successful business operator.

MISSION: Analyze this business document with exceptional depth and insight. Provide the kind of analysis that would help someone make a multi-million dollar investment decision.

COMPREHENSIVE ANALYSIS FRAMEWORK:

1. **BUSINESS MODEL & COMPETITIVE POSITIONING**
   - How exactly does this business make money? (Revenue streams, pricing model, customer acquisition)
   - What is their competitive advantage and defensive moat?
   - How do they differentiate from competitors?
   - What is their market position and share?

2. **FINANCIAL PERFORMANCE & QUALITY OF EARNINGS**
   - Analyze ALL financial metrics and trends across all available periods
   - Assess quality of earnings: How sustainable, recurring, and predictable is the revenue?
   - Identify any financial red flags or accounting irregularities
   - Calculate and interpret key financial ratios and margins

3. **GROWTH DRIVERS & SUSTAINABILITY**
   - What has driven historical growth?
   - Are growth rates sustainable or artificially inflated?
   - What are the key growth levers and constraints?
   - How scalable is the business model?

4. **RISK FACTORS & MITIGATION STRATEGIES**
   - Customer concentration and dependency risks
   - Industry disruption and competitive threats
   - Regulatory, economic, and operational risks
   - Management and key person dependencies

5. **MARKET DYNAMICS & INDUSTRY TRENDS**
   - Industry growth trends and outlook
   - Market consolidation opportunities
   - Technology disruption threats/opportunities
   - Regulatory environment changes

6. **OPERATIONAL STRENGTHS & WEAKNESSES**
   - Systems, processes, and infrastructure assessment
   - Team capabilities and organizational structure
   - Operational efficiency and improvement opportunities
   - Technology stack and digital maturity

7. **VALUE CREATION OPPORTUNITIES**
   - Revenue growth opportunities (new products, markets, pricing)
   - Cost reduction and operational efficiency improvements
   - Strategic initiatives and expansion potential
   - Technology and process improvements

8. **MANAGEMENT & ORGANIZATIONAL CAPABILITIES**
   - Leadership team strength and track record
   - Organizational depth and key person risks
   - Corporate governance and decision-making processes
   - Culture and employee engagement

ANALYSIS STYLE:
- Think like a seasoned investor who has seen hundreds of deals
- Be specific and quantitative wherever possible
- Identify both opportunities and risks with equal rigor
- Consider multiple scenarios and outcomes
- Provide nuanced insights that go beyond surface-level observations
- Connect the dots between different aspects of the business

OUTPUT REQUIREMENT:
Provide a comprehensive narrative analysis covering all these areas. Be thorough, insightful, and actionable. This analysis will inform critical investment decisions, so depth and accuracy are paramount.`;

  if (images && images.length > 0) {
    return await callOpenAIVision(intelligencePrompt, images);
  } else if (fileData) {
    return await callOpenAIText(intelligencePrompt, fileData, fileName);
  } else {
    throw new Error('No valid data for document intelligence analysis');
  }
}

// STAGE 2: Investment Decision Intelligence
async function performInvestmentIntelligence(documentAnalysis) {
  console.log('💰 Performing investment decision intelligence...');
  
  const investmentPrompt = `Based on your comprehensive business analysis, now provide investment decision intelligence. Think like a private equity professional evaluating this opportunity for acquisition.

DOCUMENT ANALYSIS:
${documentAnalysis}

INVESTMENT DECISION FRAMEWORK:

1. **INVESTMENT THESIS & RATIONALE**
   - 3-sentence investment thesis summarizing the opportunity
   - Key value proposition and differentiation
   - Strategic rationale for acquisition

2. **VALUATION ANALYSIS**
   - Fair valuation range with supporting methodology
   - Appropriate valuation multiples for this business type and industry
   - Comparison to market benchmarks and recent transactions
   - Key valuation risk factors and sensitivities

3. **DEAL STRUCTURE RECOMMENDATIONS**
   - Optimal financing structure (debt/equity mix, SBA eligibility)
   - Key terms and structure considerations
   - Risk mitigation through deal structure
   - Working capital and closing adjustments

4. **DUE DILIGENCE PRIORITIES**
   - Critical areas requiring deep investigation (ranked by importance)
   - Key questions to ask management and stakeholders
   - Financial, operational, and legal due diligence priorities
   - Red flags and deal-breaker risks to investigate

5. **INTEGRATION & OPERATIONAL CONSIDERATIONS**
   - Day 1 operational requirements and transition planning
   - Key personnel retention strategies
   - Systems integration and process standardization needs
   - Cultural integration challenges and opportunities

6. **VALUE CREATION ROADMAP**
   - 100-day plan: Immediate actions and quick wins
   - Year 1-2: Major improvement initiatives and growth strategies
   - Long-term: Strategic positioning and expansion opportunities
   - Technology and system investments required

7. **RISK ASSESSMENT & MITIGATION**
   - Investment risk rating (1-10 scale) with justification
   - Top 5 risks with specific mitigation strategies
   - Scenario analysis: best case, base case, stress case outcomes
   - Key performance indicators to monitor post-acquisition

8. **EXIT STRATEGY CONSIDERATIONS**
   - Likely exit timelines and methods (strategic sale, financial buyer, IPO)
   - Value creation required for successful exit
   - Potential acquirers and exit multiples
   - Platform vs. standalone investment considerations

INVESTMENT DECISION REQUIREMENTS:
- Provide specific, actionable recommendations
- Include quantitative analysis with ranges and confidence levels
- Consider multiple scenarios and outcomes
- Address both upside potential and downside protection
- Think about the complete investment lifecycle from acquisition to exit

OUTPUT: Comprehensive investment decision intelligence that would guide a sophisticated buyer's decision-making process.`;

  return await callOpenAI(investmentPrompt);
}

// STAGE 3: Intelligent Structured Mapping
async function performIntelligentMapping(documentAnalysis, investmentIntelligence) {
  console.log('🎯 Performing intelligent structured mapping...');
  
  const mappingPrompt = `Based on your comprehensive document analysis and investment intelligence, now map this information to a structured data format. Use intelligent inference and fuzzy matching to extract the most relevant and accurate data.

DOCUMENT ANALYSIS:
${documentAnalysis}

INVESTMENT INTELLIGENCE:
${investmentIntelligence}

INTELLIGENT MAPPING INSTRUCTIONS:
- Map similar concepts intelligently (e.g., "Commission Income" → revenue for insurance agencies)
- Use business context to make appropriate inferences
- Preserve important nuances and variations in terminology
- Calculate derived metrics where possible
- Assign confidence levels to each data point
- Flag any significant assumptions or extrapolations

REQUIRED JSON STRUCTURE:
{
  "purchasePrice": [number or null],
  "priceSource": "extracted|calculated|estimated|not_found",
  "priceConfidence": [0-100],
  "businessInfo": {
    "name": "[exact company name]",
    "type": "[business type/industry]",
    "description": "[detailed business description]",
    "location": "[city, state]",
    "employees": [number or null],
    "yearEstablished": [year or null],
    "businessModel": "[how they make money]",
    "competitiveAdvantage": "[key differentiators]"
  },
  "financialData": {
    "periods": ["array of years/periods found"],
    "revenue": {"period": [number], ...},
    "commissionIncome": {"period": [number], ...},
    "costOfRevenue": {"period": [number], ...},
    "grossProfit": {"period": [number], ...},
    "operatingExpenses": {"period": [number], ...},
    "ebitda": {"period": [number], ...},
    "adjustedEbitda": {"period": [number], ...},
    "recastEbitda": {"period": [number], ...},
    "sde": {"period": [number], ...},
    "netIncome": {"period": [number], ...},
    "cashFlow": {"period": [number], ...}
  },
  "keyMetrics": {
    "customerCount": [number or null],
    "customerRetentionRate": [number 0-1 or null],
    "averageCustomerValue": [number or null],
    "recurringRevenuePercent": [number 0-1 or null],
    "grossMargin": [number 0-1 or null],
    "ebitdaMargin": [number 0-1 or null],
    "revenueGrowthRate": [number or null],
    "customerConcentration": "[description]",
    "marketPosition": "[description]"
  },
  "intelligenceAssessment": {
    "revenueQuality": [1-10 scale],
    "competitivePosition": [1-10 scale],
    "growthSustainability": [1-10 scale],
    "managementDependency": [1-10 scale],
    "businessComplexity": [1-10 scale],
    "investmentRisk": [1-10 scale],
    "scalabilityPotential": [1-10 scale]
  },
  "valuationIntelligence": {
    "fairValueRange": [min, max],
    "valuationMethodology": "[description]",
    "appropriateMultiples": "[industry benchmarks]",
    "valuationConfidence": [0-100],
    "keyValuationDrivers": ["array of factors"],
    "valuationRisks": ["array of risk factors"]
  },
  "valueCreationPlan": [
    {
      "opportunity": "[description]",
      "timeline": "[timeframe]",
      "impact": "[expected value creation]",
      "difficulty": [1-10 scale],
      "priority": [1-10 scale]
    }
  ],
  "riskAssessment": [
    {
      "risk": "[description]",
      "impact": [1-10 scale],
      "probability": [1-10 scale],
      "mitigation": "[strategy]"
    }
  ],
  "confidence": [0-100 overall confidence in analysis]
}

Return ONLY the JSON object with no additional text.`;

  const result = await callOpenAI(mappingPrompt);
  
  try {
    return JSON.parse(result.content);
  } catch (parseError) {
    console.error('JSON parse error in mapping stage:', parseError);
    // Try to extract JSON from response
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Could not parse structured mapping result');
  }
}

// OpenAI Vision API call
async function callOpenAIVision(prompt, images) {
  const content = [{ type: 'text', text: prompt }];
  
  // Add images (limit to avoid payload issues)
  const limitedImages = images.slice(0, 5);
  limitedImages.forEach(imageBase64 => {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${imageBase64}`,
        detail: 'high'
      }
    });
  });

  return await callOpenAI(prompt, content);
}

// OpenAI Text API call
async function callOpenAIText(prompt, fileData, fileName) {
  // For text extraction, we'd need to extract text first
  // For now, delegate to text-only API
  const response = await fetch('https://analyst.ebitcommunity.com/api/analyze-text-only', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileData, fileName })
  });

  if (!response.ok) {
    throw new Error(`Text extraction failed: ${response.status}`);
  }

  const result = await response.json();
  const extractedText = result.extractedText || 'No text extracted';
  
  const fullPrompt = `${prompt}\n\nDOCUMENT TEXT:\n${extractedText}`;
  return await callOpenAI(fullPrompt);
}

// Generic OpenAI API call
async function callOpenAI(prompt, content = null) {
  const messages = [{
    role: 'user',
    content: content || prompt
  }];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: messages,
      max_tokens: 4096,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return {
    content: result.choices[0].message.content,
    usage: result.usage
  };
}

// Calculate overall confidence from all stages
function calculateOverallConfidence(documentAnalysis, investmentIntelligence, structuredData) {
  // Base confidence on data completeness and consistency
  let confidence = 70; // Base confidence
  
  // Adjust based on structured data completeness
  if (structuredData.purchasePrice) confidence += 10;
  if (structuredData.financialData && Object.keys(structuredData.financialData.revenue || {}).length > 2) confidence += 10;
  if (structuredData.keyMetrics && Object.values(structuredData.keyMetrics).filter(v => v !== null).length > 3) confidence += 5;
  if (structuredData.intelligenceAssessment) confidence += 5;
  
  return Math.min(confidence, 95); // Cap at 95%
}

// Vercel configuration
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};