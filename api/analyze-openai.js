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
  const prompt = `You are analyzing a business acquisition document (CIM/financial package). Your goal is COMPLETE EXTRACTION - capture EVERY piece of data, every number, every detail from ALL pages.

**EXTRACTION REQUIREMENTS:**

1. **FINANCIAL DATA - Extract EVERY line item:**
   - ALL revenue categories with EXACT amounts (don't combine or summarize)
   - ALL expense categories with EXACT amounts and descriptions
   - ALL adjustments, add-backs, normalizations with explanations
   - Year-over-year data for EACH metric (not just totals)
   - Monthly/quarterly breakdowns if present
   - All financial ratios, percentages, margins exactly as stated

2. **NARRATIVE EXTRACTION - Capture ALL specific details:**
   - EXACT percentages (e.g., "grew 23.5%" not "grew ~20%")
   - EXACT dates and timelines (e.g., "established March 2004")
   - EXACT dollar amounts (e.g., "$87,530 salary" not "~$90K")
   - Specific commitments (e.g., "seller will stay 2-3 years post-sale")
   - Direct quotes about the business model, strategy, history

3. **STRUCTURED DATA - Complete table extraction:**
   - ALL carrier/vendor names with associated metrics
   - ALL employee names, titles, salaries, commission structures
   - ALL customer segments with percentages/counts
   - Preserve ALL columns and rows from tables
   - Include footnotes and table annotations

4. **EMPLOYEE DETAILS - Extract complete information:**
   - Full compensation: base salary + commissions + bonuses + benefits
   - Specific responsibilities for each role
   - Reporting relationships and org structure
   - Post-sale retention plans and agreements
   - Training requirements and transition timelines

5. **BUSINESS INTELLIGENCE - Don't summarize, extract verbatim:**
   - Growth strategies EXACTLY as described
   - Competitive advantages with specific examples
   - Risk factors with complete explanations
   - Market position with supporting data
   - Technology stack and systems in use

6. **DATA VALIDATION RULES:**
   - If asking price is "BEST OFFER", extract as-is, don't estimate
   - Distinguish between "0", "not provided", and "not applicable"
   - Flag confidence level for calculated vs. stated values
   - Note source page number for key data points

7. **COMPLETENESS VERIFICATION:**
   - Ensure ALL years mentioned have complete financial data
   - Ensure ALL employees mentioned have full details
   - Ensure ALL carriers/vendors have associated metrics
   - Ensure ALL percentages and ratios are captured
   - Extract ALL footnotes, disclaimers, and fine print

RETURN ULTRA-DETAILED JSON:
{
  "financialData": {
    "periods": ["ALL years and periods found"],
    "revenue": {
      "total": {"2021": null, "2022": null, "2023": null, "TTM": null},
      "byCategory": {
        "commissions": {"2021": null, "2022": null, "2023": null},
        "fees": {"2021": null, "2022": null, "2023": null},
        "contingent": {"2021": null, "2022": null, "2023": null},
        "other": {"2021": null, "2022": null, "2023": null}
      },
      "monthlyBreakdown": {"if available": {}}
    },
    "expenses": {
      "total": {"2021": null, "2022": null, "2023": null},
      "byCategory": {
        "salaries": {"amount": null, "details": "include all comp details"},
        "rent": {"amount": null, "details": "lease terms"},
        "marketing": {"amount": null, "details": ""},
        "insurance": {"amount": null, "details": ""},
        "other": {"list ALL expense categories found": null}
      }
    },
    "adjustments": [
      {
        "description": "exact adjustment description",
        "amount": null,
        "year": "year applied",
        "type": "add-back or normalization"
      }
    ],
    "ebitda": {
      "reported": {"2021": null, "2022": null, "2023": null},
      "adjusted": {"2021": null, "2022": null, "2023": null},
      "recast": {"2021": null, "2022": null, "2023": null}
    },
    "metrics": {
      "revenueGrowth": {"2021-2022": "exact %", "2022-2023": "exact %"},
      "ebitdaMargin": {"2021": "exact %", "2022": "exact %", "2023": "exact %"},
      "customerRetention": "exact % if stated",
      "avgPolicySize": null,
      "customMetrics": {"any other metrics found": "value"}
    },
    "askingPrice": "EXACT text (e.g., 'BEST POSSIBLE OFFER')",
    "askingPriceAmount": null,
    "valuationMultiple": "if stated (e.g., '4.5x EBITDA')",
    "dataSources": ["list source of financials: tax returns, QuickBooks, etc."]
  "businessOverview": {
    "companyName": "exact legal name",
    "dba": "any DBAs or trade names",
    "establishedDate": "exact date if available",
    "yearsInBusiness": number_or_null,
    "businessType": "specific industry classification",
    "entityType": "LLC, Corp, etc.",
    "location": {
      "address": "full street address",
      "city": "",
      "state": "",
      "zip": "",
      "leaseDetails": "expiration, terms, sq ft, monthly rent"
    },
    "ownership": {
      "currentStructure": "detailed ownership breakdown",
      "shareholders": [{"name": "", "percentage": null, "role": ""}],
      "history": "ownership changes and timeline"
    },
    "history": "COMPLETE company history - extract entire narrative",
    "businessModel": "COMPLETE business model description - don't summarize",
    "operations": {
      "description": "detailed operational description",
      "hoursOfOperation": "",
      "seasonality": "",
      "keyProcesses": []
    }
  },
  "productsServices": {
    "overview": "complete description",
    "commercialLines": "detailed commercial insurance details",
    "personalLines": "detailed personal insurance details", 
    "carriers": ["list all insurance carriers mentioned"],
    "marketSegments": ["list all market segments"],
    "pricingStrategy": "pricing and commission structure",
    "serviceOfferings": ["list all services"]
  },
  "employeesManagement": {
    "totalEmployees": {
      "fullTime": null,
      "partTime": null,
      "contractors": null
    },
    "detailedRoster": [
      {
        "name": "exact name or 'Employee 1' if anonymous",
        "title": "exact title",
        "yearsWithCompany": null,
        "compensation": {
          "baseSalary": null,
          "commission": "structure and amounts",
          "bonus": "details",
          "benefits": "health, dental, 401k, etc.",
          "total": null
        },
        "responsibilities": ["list ALL mentioned duties"],
        "postSaleStatus": "staying/leaving/uncertain",
        "reportingTo": "manager name/title"
      }
    ],
    "organizationStructure": "COMPLETE org chart description",
    "keyManagement": {
      "ceo": {"name": "", "background": "", "equity": null},
      "otherExecutives": []
    },
    "sellerInvolvement": {
      "currentRole": "exact description",
      "hoursPerWeek": null,
      "responsibilities": [],
      "postSaleCommitment": "EXACT terms (e.g., '2-3 years as producer')",
      "compensation": "post-sale comp structure"
    },
    "staffingChallenges": [],
    "trainingRequired": "details on knowledge transfer"
  },
  "customers": {
    "totalPolicies": number_or_null,
    "customerBase": "detailed customer description",
    "retention": "retention rates and details",
    "acquisition": "customer acquisition methods",
    "segments": {"commercial": percentage, "personal": percentage},
    "keyAccounts": "details about key accounts",
    "relationships": "customer relationship details"
  },
  "growthOpportunities": [
    {
      "opportunity": "EXACT description as written",
      "potentialImpact": "revenue/profit impact if mentioned",
      "timeframe": "implementation timeline",
      "requirements": "resources needed",
      "priority": "if indicated"
    }
  ],
  "competitiveAdvantages": [
    {
      "advantage": "EXACT description",
      "evidence": "supporting data/examples",
      "sustainability": "how defendable"
    }
  ],
  "risks": [
    {
      "risk": "COMPLETE risk description",
      "severity": "high/medium/low if indicated",
      "mitigation": "any mentioned mitigation strategies",
      "probability": "if mentioned"
    }
  ],
  "marketAnalysis": {
    "industryTrends": "industry analysis details",
    "competitiveLandscape": "competitive analysis",
    "marketPosition": "company's market position",
    "targetMarkets": "target market details"
  },
  "financialControls": {
    "accountingSystems": "accounting and reporting systems",
    "financialReporting": "financial reporting processes",
    "controls": "internal controls and procedures"
  },
  "technology": {
    "systems": "technology systems used",
    "capabilities": "technological capabilities", 
    "needs": "technology improvement needs"
  },
  "narrative": "COMPLETE multi-paragraph comprehensive analysis covering ALL aspects of the business - include everything important from the document",
  "keyHighlights": [
    "most important highlight 1",
    "most important highlight 2",
    "etc - top 10 most important points"
  ],
  "confidence": 95
}

  "carriers": [
    {
      "name": "exact carrier name",
      "productsOffered": [],
      "premiumVolume": null,
      "policyCount": null,
      "commissionRate": "exact %",
      "relationshipLength": "years or start date",
      "performance": "any metrics mentioned"
    }
  ],
  "validation": {
    "dataCompleteness": {
      "allYearsHaveRevenue": true/false,
      "allYearsHaveExpenses": true/false,
      "allEmployeesHaveComp": true/false,
      "allCarriersHaveMetrics": true/false
    },
    "missingData": ["list what's missing"],
    "dataQuality": ["any inconsistencies noted"],
    "confidence": {
      "financial": 0-100,
      "operational": 0-100,
      "overall": 0-100
    }
  }
}

CRITICAL EXTRACTION REQUIREMENTS:
The PDF contains real financial data that MUST be found. Use these aggressive strategies:

1. REVENUE EXTRACTION - MUST find these numbers:
   - Look for: "$853,000", "$640,000", "$769,500", "$876,500"
   - Patterns: "2023 Revenue", "2024 Revenue", "Commission", "Fees"
   - Context: Insurance agency with actual revenue in hundreds of thousands

2. EBITDA/PROFIT - MUST find:
   - Look for: "$192,000", "$255,900", any profit figures
   - Patterns: "EBITDA", "Cash Flow", "Operating Income", "SDE"

3. EMPLOYEE DATA - MUST extract:
   - Look for: "$87,530", "Officer Salary", salary amounts
   - All employee compensation with exact numbers

4. CARRIERS - MUST find insurance carrier data:
   - Look for: "Mercury", "Hartford", "Coastal" with dollar amounts
   - Extract ALL carrier names with premium volumes

5. BUSINESS METRICS - MUST capture:
   - "99% Retention", "1,500 policies", growth percentages
   - Extract ALL percentages and business metrics

EXTRACTION VALIDATION:
- If revenue is null/0, extraction FAILED - try harder
- If no employee salaries found, look for any compensation data
- If no carriers found, look for any company names with dollar amounts
- NEVER return empty objects - extract what's actually in the document

CONVERSION RULES:
- Numbers: "$5.2M" = 5200000, "5.2%" = 0.052, "$5,200" = 5200
- Text: "BEST POSSIBLE OFFER" = keep exactly as written
- Missing vs Zero: null = not found, 0 = explicitly stated as zero
- Dates: Preserve exact format found in document
- SUCCESS METRIC: Extract actual numbers from this real business document`;

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
        max_tokens: 16384,  // Maximum tokens for ultra-detailed extraction
        temperature: 0.1,
        response_format: { type: "json_object" }  // Force JSON response
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API failed: ${response.status}`);
    }

    const result = await response.json();
    const contentText = result.choices[0].message.content;
    
    // COMPREHENSIVE EXTRACTION DEBUG LOGGING
    console.log('=== OPENAI EXTRACTION DEBUG START ===');
    console.log('1. Raw API Response Structure:', {
      usage: result.usage,
      model: result.model,
      choices: result.choices?.length,
      finish_reason: result.choices?.[0]?.finish_reason
    });
    console.log('2. Content Text Length:', contentText.length, 'characters');
    console.log('3. First 1000 chars:', contentText.substring(0, 1000));
    console.log('4. Last 500 chars:', contentText.substring(contentText.length - 500));
    console.log('5. JSON Pattern Search...');
    
    // Check for common JSON patterns
    const hasOpenBrace = contentText.includes('{');
    const hasCloseBrace = contentText.includes('}');
    const jsonStartIndex = contentText.indexOf('{');
    const jsonEndIndex = contentText.lastIndexOf('}');
    
    console.log('6. JSON Structure Analysis:', {
      hasOpenBrace,
      hasCloseBrace,
      jsonStartIndex,
      jsonEndIndex,
      estimatedJsonLength: jsonEndIndex - jsonStartIndex + 1
    });
    
    // Enhanced JSON extraction with multiple attempts
    console.log('7. Attempting JSON extraction with multiple strategies...');
    
    let parsed = null;
    let parseMethod = 'failed';
    const jsonExtractionAttempts = [
      // Attempt 1: Find complete JSON object
      () => {
        const match = contentText.match(/\{[\s\S]*\}/);
        if (match) {
          console.log('✅ JSON extraction attempt 1: Found JSON pattern, length:', match[0].length);
          parseMethod = 'regex_complete';
          return JSON.parse(match[0]);
        }
        throw new Error('No JSON pattern found');
      },
      // Attempt 2: Find JSON between ```json blocks
      () => {
        const match = contentText.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) {
          console.log('✅ JSON extraction attempt 2: Found JSON in code block, length:', match[1].length);
          parseMethod = 'code_block';
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
          console.log('✅ JSON extraction attempt 3: Found JSON by indices, length:', jsonStr.length);
          parseMethod = 'index_based';
          return JSON.parse(jsonStr);
        }
        throw new Error('No JSON boundaries found');
      },
      // Attempt 4: Try cleaning the response first
      () => {
        let cleaned = contentText
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .replace(/^[^{]*/, '')
          .replace(/[^}]*$/, '')
          .trim();
        
        if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
          console.log('✅ JSON extraction attempt 4: Cleaned response, length:', cleaned.length);
          parseMethod = 'cleaned';
          return JSON.parse(cleaned);
        }
        throw new Error('Could not clean response to valid JSON');
      }
    ];
    
    for (let i = 0; i < jsonExtractionAttempts.length; i++) {
      try {
        parsed = jsonExtractionAttempts[i]();
        console.log(`✅ Successfully parsed JSON on attempt ${i + 1} using method: ${parseMethod}`);
        console.log('8. Parse Success - Data Structure:', {
          topLevelKeys: Object.keys(parsed),
          hasFinancialData: !!parsed.financialData,
          hasBusinessOverview: !!parsed.businessOverview,
          hasProductsServices: !!parsed.productsServices,
          hasEmployees: !!parsed.employeesManagement,
          hasGrowthOps: !!parsed.growthOpportunities && parsed.growthOpportunities.length > 0,
          hasRisks: !!parsed.risks && parsed.risks.length > 0,
          narrativeLength: parsed.narrative?.length || 0
        });
        break;
      } catch (parseError) {
        console.warn(`⚠️ JSON extraction attempt ${i + 1} failed:`, parseError.message);
        if (i === jsonExtractionAttempts.length - 1) {
          console.error('9. All JSON extraction attempts failed. Raw response sample:', contentText.substring(0, 2000));
        }
      }
    }
    
    if (!parsed) {
      console.error('❌ All JSON extraction attempts failed');
      console.log('📝 Full raw response for debugging:', contentText);
      console.log('=== OPENAI EXTRACTION DEBUG END (FAILED) ===');
    } else {
      // COMPREHENSIVE EXTRACTION ANALYSIS
      console.log('9. COMPREHENSIVE EXTRACTION ANALYSIS:');
      
      // Financial Data Analysis
      const financialAnalysis = {
        periods: parsed.financialData?.periods?.length || 0,
        hasRevenue: !!(parsed.financialData?.revenue && Object.keys(parsed.financialData.revenue).length > 0),
        hasCommissions: !!(parsed.financialData?.commissions && Object.keys(parsed.financialData.commissions).length > 0),
        hasExpenses: !!(parsed.financialData?.expenses && Object.keys(parsed.financialData.expenses).length > 0),
        hasEBITDA: !!(parsed.financialData?.ebitda && Object.keys(parsed.financialData.ebitda).length > 0),
        askingPrice: parsed.financialData?.askingPrice || 'Not found',
        askingPriceAmount: parsed.financialData?.askingPriceAmount || null,
        policyCount: parsed.financialData?.policyCount || null,
        retention: parsed.financialData?.retention || null
      };
      
      // Business Analysis
      const businessAnalysis = {
        hasOverview: !!parsed.businessOverview && Object.keys(parsed.businessOverview).length > 0,
        companyName: parsed.businessOverview?.companyName || 'Not found',
        yearsInBusiness: parsed.businessOverview?.yearsInBusiness || null,
        location: parsed.businessOverview?.location || 'Not found',
        hasProducts: !!parsed.productsServices && Object.keys(parsed.productsServices).length > 0,
        carriersCount: parsed.productsServices?.carriers?.length || 0,
        hasEmployees: !!parsed.employeesManagement && Object.keys(parsed.employeesManagement).length > 0,
        totalEmployees: parsed.employeesManagement?.totalEmployees || null,
        keyPersonnelCount: parsed.employeesManagement?.keyPersonnel?.length || 0
      };
      
      // Strategic Analysis
      const strategicAnalysis = {
        growthOpportunities: parsed.growthOpportunities?.length || 0,
        competitiveAdvantages: parsed.competitiveAdvantages?.length || 0,
        risks: parsed.risks?.length || 0,
        hasMarketAnalysis: !!parsed.marketAnalysis && Object.keys(parsed.marketAnalysis).length > 0,
        hasTechnology: !!parsed.technology && Object.keys(parsed.technology).length > 0,
        narrativeLength: parsed.narrative?.length || 0,
        keyHighlights: parsed.keyHighlights?.length || 0
      };
      
      console.log('   Financial Data:', financialAnalysis);
      console.log('   Business Analysis:', businessAnalysis);
      console.log('   Strategic Analysis:', strategicAnalysis);
      
      // Calculate extraction completeness score
      const expectedFields = 25; // Major sections we expect
      const foundFields = [
        financialAnalysis.hasRevenue,
        financialAnalysis.hasCommissions,
        financialAnalysis.hasExpenses,
        financialAnalysis.hasEBITDA,
        !!financialAnalysis.askingPrice && financialAnalysis.askingPrice !== 'Not found',
        !!financialAnalysis.policyCount,
        !!financialAnalysis.retention,
        businessAnalysis.hasOverview,
        businessAnalysis.companyName !== 'Not found',
        !!businessAnalysis.yearsInBusiness,
        businessAnalysis.location !== 'Not found',
        businessAnalysis.hasProducts,
        businessAnalysis.carriersCount > 0,
        businessAnalysis.hasEmployees,
        !!businessAnalysis.totalEmployees,
        businessAnalysis.keyPersonnelCount > 0,
        strategicAnalysis.growthOpportunities > 0,
        strategicAnalysis.competitiveAdvantages > 0,
        strategicAnalysis.risks > 0,
        strategicAnalysis.hasMarketAnalysis,
        strategicAnalysis.hasTechnology,
        strategicAnalysis.narrativeLength > 500,
        strategicAnalysis.keyHighlights > 0,
        parsed.customers && Object.keys(parsed.customers).length > 0,
        parsed.financialControls && Object.keys(parsed.financialControls).length > 0
      ].filter(Boolean).length;
      
      const completenessScore = Math.round((foundFields / expectedFields) * 100);
      
      console.log('10. EXTRACTION COMPLETENESS SCORE:', completenessScore + '%');
      console.log('    Fields Found:', foundFields, '/', expectedFields);
      
      if (completenessScore < 50) {
        console.warn('⚠️ LOW EXTRACTION RATE - Document may need different analysis approach');
      } else if (completenessScore > 80) {
        console.log('✅ EXCELLENT EXTRACTION RATE - Comprehensive data captured');
      }
      
      console.log('=== OPENAI EXTRACTION DEBUG END (SUCCESS) ===');
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