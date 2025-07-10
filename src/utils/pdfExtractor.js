import * as pdfjsLib from 'pdfjs-dist/webpack';
import { 
  EXTRACTION_PATTERNS, 
  aggressiveExtract, 
  extractByYear, 
  extractTableData,
  cleanNumber,
  extractWithContext
} from './extractionPatterns';

// Multi-pass PDF text extraction
export async function extractAllText(pdfFile) {
  const results = {
    pages: [],
    fullText: '',
    metadata: {
      pageCount: 0,
      extractionMethod: 'pdfjs',
      timestamp: new Date().toISOString()
    },
    extractionLog: []
  };

  try {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    results.metadata.pageCount = pdf.numPages;

    console.log(`📄 Extracting text from ${pdf.numPages} pages...`);

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items.map(item => item.str).join(' ');
        
        results.pages.push({
          pageNumber: pageNum,
          text: pageText,
          length: pageText.length
        });
        
        results.fullText += `\n--- PAGE ${pageNum} ---\n${pageText}`;
        
        console.log(`✅ Page ${pageNum}: ${pageText.length} characters extracted`);
        
      } catch (pageError) {
        console.error(`❌ Error extracting page ${pageNum}:`, pageError);
        results.extractionLog.push({
          page: pageNum,
          error: pageError.message,
          fallback: 'attempted'
        });
      }
    }

    results.metadata.totalCharacters = results.fullText.length;
    console.log(`📊 Total text extracted: ${results.metadata.totalCharacters} characters`);

    if (results.fullText.length < 100) {
      console.warn('⚠️ Very little text extracted - PDF might be image-based');
      results.extractionLog.push({
        warning: 'Low text extraction',
        suggestion: 'Consider OCR for image-based PDFs'
      });
    }

  } catch (error) {
    console.error('❌ PDF extraction failed:', error);
    throw new Error(`PDF extraction failed: ${error.message}`);
  }

  return results;
}

// Comprehensive financial data extraction
export function extractFinancialData(textData) {
  const fullText = textData.fullText;
  const extractionResults = {
    revenue: {},
    ebitda: {},
    expenses: {},
    compensation: {},
    carriers: [],
    metrics: {},
    pricing: {},
    years: [],
    debugLog: {},
    confidence: {}
  };

  console.log('🔍 Starting comprehensive financial extraction...');

  // Extract years first to provide context
  const yearMatches = [...new Set(fullText.match(/(20\d{2})/g) || [])].sort();
  extractionResults.years = yearMatches;
  console.log('📅 Years found:', yearMatches);

  // 1. AGGRESSIVE REVENUE EXTRACTION
  console.log('💰 Extracting revenue data...');
  
  // Try multiple revenue extraction strategies
  const revenueStrategies = [
    { name: 'commission_fees', patterns: EXTRACTION_PATTERNS.revenue.slice(3, 5) },
    { name: 'general_revenue', patterns: EXTRACTION_PATTERNS.revenue.slice(0, 3) },
    { name: 'ttm_revenue', patterns: EXTRACTION_PATTERNS.revenue.slice(5, 7) }
  ];

  for (const strategy of revenueStrategies) {
    const result = aggressiveExtract(
      fullText, 
      'revenue', 
      strategy.patterns, 
      { minValue: 10000, maxValue: 50000000 }
    );
    
    if (result.value) {
      extractionResults.revenue[strategy.name] = result.value;
      extractionResults.debugLog[`revenue_${strategy.name}`] = result.debugLog;
      extractionResults.confidence[`revenue_${strategy.name}`] = result.confidence;
      
      console.log(`✅ ${strategy.name}: $${result.value.toLocaleString()}`);
      console.log(`   Source: "${result.source}"`);
    }
  }

  // Extract revenue by year
  for (const year of yearMatches) {
    const yearResult = aggressiveExtract(
      fullText,
      'revenue',
      EXTRACTION_PATTERNS.revenue,
      { yearContext: year, minValue: 10000 }
    );
    
    if (yearResult.value) {
      extractionResults.revenue[year] = yearResult.value;
      console.log(`✅ ${year} Revenue: $${yearResult.value.toLocaleString()}`);
    }
  }

  // 2. AGGRESSIVE EBITDA EXTRACTION
  console.log('📊 Extracting EBITDA/SDE data...');
  
  for (const year of yearMatches) {
    const ebitdaResult = aggressiveExtract(
      fullText,
      'ebitda',
      EXTRACTION_PATTERNS.ebitda,
      { yearContext: year, minValue: 0 }
    );
    
    if (ebitdaResult.value) {
      extractionResults.ebitda[year] = ebitdaResult.value;
      console.log(`✅ ${year} EBITDA: $${ebitdaResult.value.toLocaleString()}`);
    }
  }

  // Current year EBITDA (TTM)
  const currentEbitda = aggressiveExtract(
    fullText,
    'ebitda',
    EXTRACTION_PATTERNS.ebitda,
    { minValue: 0, maxValue: 10000000 }
  );
  
  if (currentEbitda.value) {
    extractionResults.ebitda.current = currentEbitda.value;
    extractionResults.debugLog.ebitda_current = currentEbitda.debugLog;
    console.log(`✅ Current EBITDA: $${currentEbitda.value.toLocaleString()}`);
  }

  // 3. EMPLOYEE COMPENSATION EXTRACTION
  console.log('👥 Extracting employee compensation...');
  
  const compensationResult = aggressiveExtract(
    fullText,
    'salary',
    EXTRACTION_PATTERNS.compensation,
    { minValue: 20000, maxValue: 500000 }
  );
  
  if (compensationResult.value) {
    extractionResults.compensation.officer_salary = compensationResult.value;
    extractionResults.debugLog.compensation = compensationResult.debugLog;
    console.log(`✅ Officer Salary: $${compensationResult.value.toLocaleString()}`);
    console.log(`   Source: "${compensationResult.source}"`);
  }

  // 4. CARRIER EXTRACTION
  console.log('🏢 Extracting carrier information...');
  
  const carrierMatches = extractWithContext(fullText, EXTRACTION_PATTERNS.carriers[0], 100);
  
  carrierMatches.forEach((match, index) => {
    const carrierName = match.captured;
    const valueMatch = match.context.match(/\$?([\d,]+(?:\.\d+)?)/);
    
    if (valueMatch) {
      const value = cleanNumber(valueMatch[1]);
      if (value && value > 1000) {
        extractionResults.carriers.push({
          name: carrierName.trim(),
          premium: value,
          source: match.context
        });
        console.log(`✅ Carrier: ${carrierName.trim()} - $${value.toLocaleString()}`);
      }
    }
  });

  // 5. BUSINESS METRICS EXTRACTION
  console.log('📈 Extracting business metrics...');
  
  // Retention rate
  const retentionResult = aggressiveExtract(
    fullText,
    'retention',
    EXTRACTION_PATTERNS.metrics.slice(0, 2),
    { minValue: 0, maxValue: 100 }
  );
  
  if (retentionResult.value) {
    // Convert to decimal if it's a percentage
    const retention = retentionResult.value > 1 ? retentionResult.value / 100 : retentionResult.value;
    extractionResults.metrics.retention = retention;
    console.log(`✅ Retention: ${(retention * 100).toFixed(1)}%`);
  }

  // Policy count
  const policyResult = aggressiveExtract(
    fullText,
    'policies',
    [EXTRACTION_PATTERNS.metrics[4]],
    { minValue: 1, maxValue: 100000 }
  );
  
  if (policyResult.value) {
    extractionResults.metrics.policy_count = policyResult.value;
    console.log(`✅ Policy Count: ${policyResult.value.toLocaleString()}`);
  }

  // Growth rate
  const growthResult = aggressiveExtract(
    fullText,
    'growth',
    EXTRACTION_PATTERNS.metrics.slice(2, 4),
    { minValue: 0, maxValue: 200 }
  );
  
  if (growthResult.value) {
    const growth = growthResult.value > 1 ? growthResult.value / 100 : growthResult.value;
    extractionResults.metrics.growth_rate = growth;
    console.log(`✅ Growth Rate: ${(growth * 100).toFixed(1)}%`);
  }

  // 6. PRICING/VALUATION EXTRACTION
  console.log('💵 Extracting pricing information...');
  
  const priceResult = aggressiveExtract(
    fullText,
    'price',
    EXTRACTION_PATTERNS.price,
    { minValue: 100000, maxValue: 100000000 }
  );
  
  if (priceResult.value) {
    extractionResults.pricing.asking_price = priceResult.value;
    console.log(`✅ Asking Price: $${priceResult.value.toLocaleString()}`);
  }

  // Check for "BEST OFFER" or similar text
  if (/best\s*(?:possible\s*)?offer/i.test(fullText)) {
    extractionResults.pricing.asking_price_text = "BEST POSSIBLE OFFER";
    console.log('✅ Asking Price: BEST POSSIBLE OFFER');
  }

  // 7. VALIDATION AND ERROR CHECKING
  console.log('🔍 Validating extraction results...');
  
  const validationLog = [];
  
  // Check for missing critical data
  if (Object.keys(extractionResults.revenue).length === 0) {
    validationLog.push({
      field: 'revenue',
      status: 'MISSING',
      action: 'Review text for revenue keywords',
      sampleText: fullText.substring(0, 500)
    });
    console.error('❌ NO REVENUE DATA EXTRACTED');
  }
  
  if (Object.keys(extractionResults.ebitda).length === 0) {
    validationLog.push({
      field: 'ebitda',
      status: 'MISSING',
      action: 'Look for cash flow or profit data'
    });
    console.warn('⚠️ NO EBITDA DATA EXTRACTED');
  }
  
  if (extractionResults.carriers.length === 0) {
    validationLog.push({
      field: 'carriers',
      status: 'MISSING',
      action: 'Check for insurance carrier tables'
    });
    console.warn('⚠️ NO CARRIER DATA EXTRACTED');
  }

  extractionResults.validation = validationLog;
  
  // Calculate overall confidence score
  const fieldsWithData = [
    Object.keys(extractionResults.revenue).length > 0,
    Object.keys(extractionResults.ebitda).length > 0,
    extractionResults.carriers.length > 0,
    Object.keys(extractionResults.metrics).length > 0,
    Object.keys(extractionResults.compensation).length > 0
  ].filter(Boolean).length;
  
  extractionResults.overallConfidence = (fieldsWithData / 5) * 100;
  
  console.log(`📊 Extraction completed with ${extractionResults.overallConfidence}% confidence`);
  console.log('📋 Extraction Summary:', {
    revenue_fields: Object.keys(extractionResults.revenue).length,
    ebitda_fields: Object.keys(extractionResults.ebitda).length,
    carriers: extractionResults.carriers.length,
    metrics: Object.keys(extractionResults.metrics).length,
    compensation_fields: Object.keys(extractionResults.compensation).length
  });

  return extractionResults;
}

// Main extraction function
export async function extractAndAnalyze(pdfFile) {
  console.log('🚀 Starting comprehensive PDF extraction and analysis...');
  
  try {
    // Step 1: Extract all text
    const textData = await extractAllText(pdfFile);
    
    // Step 2: Extract financial data with aggressive patterns
    const financialData = extractFinancialData(textData);
    
    // Step 3: Combine results
    const result = {
      ...textData,
      financialData,
      summary: {
        extraction_success: financialData.overallConfidence > 50,
        confidence_score: financialData.overallConfidence,
        fields_extracted: Object.keys(financialData).filter(key => 
          key !== 'debugLog' && key !== 'confidence' && key !== 'validation'
        ).length,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('✅ Comprehensive extraction completed successfully');
    return result;
    
  } catch (error) {
    console.error('❌ Extraction failed:', error);
    throw error;
  }
}