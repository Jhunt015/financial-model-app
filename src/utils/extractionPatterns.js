// Comprehensive extraction patterns for aggressive data capture

export const EXTRACTION_PATTERNS = {
  // Revenue patterns - MUST find these
  revenue: [
    /(?:revenue|income|sales|gross)\s*(?:for\s*)?(?:20\d{2})?[:＄$]\s*([\d,]+(?:\.\d+)?)/gi,
    /\$?([\d,]+(?:\.\d+)?)\s*(?:in\s*)?(?:revenue|income|sales)/gi,
    /(20\d{2})\s*(?:revenue|income|sales)[:＄$]\s*([\d,]+(?:\.\d+)?)/gi,
    /(?:commissions?|fees?)\s*[:＄$]\s*([\d,]+(?:\.\d+)?)/gi,
    /\$?([\d,]+(?:\.\d+)?)\s*(?:commission|fee)/gi,
    /total\s*(?:revenue|income|sales)\s*\$?([\d,]+(?:\.\d+)?)/gi,
    /(?:trailing|ttm|twelve)\s*(?:month|months)\s*[:＄$]\s*([\d,]+(?:\.\d+)?)/gi,
    /\$?([\d,]+(?:\.\d+)?)[kKmM]?\s*(?:annual|yearly)?\s*(?:revenue|sales)/gi
  ],

  // EBITDA patterns
  ebitda: [
    /ebitda\s*[:＄$]\s*([\d,]+(?:\.\d+)?)/gi,
    /\$?([\d,]+(?:\.\d+)?)\s*ebitda/gi,
    /adjusted\s*ebitda\s*[:＄$]\s*([\d,]+(?:\.\d+)?)/gi,
    /recast\s*ebitda\s*[:＄$]\s*([\d,]+(?:\.\d+)?)/gi,
    /sde\s*[:＄$]\s*([\d,]+(?:\.\d+)?)/gi,
    /seller'?s?\s*discretionary\s*earnings?\s*[:＄$]\s*([\d,]+(?:\.\d+)?)/gi,
    /cash\s*flow\s*[:＄$]\s*([\d,]+(?:\.\d+)?)/gi,
    /operating\s*income\s*[:＄$]\s*([\d,]+(?:\.\d+)?)/gi
  ],

  // Employee compensation patterns
  compensation: [
    /officer\s*salary\s*(?:of\s*)?\$?([\d,]+(?:\.\d+)?)/gi,
    /salary\s*(?:of\s*)?\$?([\d,]+(?:\.\d+)?)\s*(?:\+|plus)?\s*(\d+%?)?\s*(?:commission)?/gi,
    /\$?([\d,]+(?:\.\d+)?)\s*salary\s*(?:plus|and)?\s*(\d+%?)?/gi,
    /earns?\s*\$?([\d,]+(?:\.\d+)?)\s*(?:plus|and)?/gi,
    /\$?(\d+(?:\.\d+)?)\s*(?:\/hr|\/hour|hr|hour|hourly)/gi,
    /compensation\s*[:＄$]\s*([\d,]+(?:\.\d+)?)/gi,
    /base\s*(?:salary|pay)\s*[:＄$]\s*([\d,]+(?:\.\d+)?)/gi,
    /total\s*compensation\s*[:＄$]\s*([\d,]+(?:\.\d+)?)/gi
  ],

  // Carrier/Premium patterns
  carriers: [
    /([A-Z][a-zA-Z\s&]+?)\s*\$?([\d,]+(?:\.\d+)?)\s*(?:premium|in\s*premium)?/gi,
    /carrier[:\s]+([^$\n]+?)\s*\$?([\d,]+(?:\.\d+)?)/gi,
    /([A-Z][a-zA-Z\s&]+?)\s*(?:carrier|company|underwriter)\s*[:＄$]\s*([\d,]+(?:\.\d+)?)/gi,
    /premium\s*volume\s*[:＄$]\s*([\d,]+(?:\.\d+)?)/gi
  ],

  // Business metrics
  metrics: [
    /(\d+(?:\.\d+)?)\s*%?\s*retention/gi,
    /retention\s*(?:rate)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%?/gi,
    /(\d+(?:\.\d+)?)\s*%?\s*growth/gi,
    /growth\s*(?:rate)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%?/gi,
    /([\d,]+)\s*(?:policies|policy|accounts?)/gi,
    /(\d+(?:\.\d+)?)\s*%?\s*(?:commercial|personal)\s*(?:lines?)?/gi,
    /(\d+(?:\.\d+)?)\s*%?\s*margin/gi
  ],

  // Price/Valuation patterns
  price: [
    /asking\s*price\s*[:=]?\s*\$?([\d,]+(?:\.\d+)?[kKmM]?)/gi,
    /best\s*(?:possible\s*)?offer/gi,
    /purchase\s*price\s*[:=]?\s*\$?([\d,]+(?:\.\d+)?[kKmM]?)/gi,
    /(\d+(?:\.\d+)?)\s*[xX]\s*(?:ebitda|sde|revenue)/gi,
    /multiple\s*[:=]?\s*(\d+(?:\.\d+)?)\s*[xX]?/gi
  ],

  // Year extraction
  years: [
    /(?:fiscal\s*year|fy|year|cy)?\s*(20\d{2})/gi,
    /(?:for|in|during)\s*(20\d{2})/gi,
    /(20\d{2})\s*(?:results?|performance|financials?)/gi
  ],

  // General number extraction (fallback)
  numbers: [
    /\$\s*([\d,]+(?:\.\d+)?[kKmM]?)/g,
    /(?:[\s:])([\d,]+(?:\.\d+)?)\s*(?:thousand|million|k|m)/gi,
    /([\d,]+(?:\.\d+)?)\s*(?=\s*(?:in|for|during|revenue|income|sales|ebitda))/gi
  ]
};

// Helper function to clean extracted numbers
export function cleanNumber(str) {
  if (!str) return null;
  
  // Remove currency symbols and spaces
  let cleaned = str.toString().replace(/[$,\s]/g, '');
  
  // Handle K/M/B suffixes
  if (/k$/i.test(cleaned)) {
    cleaned = parseFloat(cleaned.replace(/k$/i, '')) * 1000;
  } else if (/m$/i.test(cleaned)) {
    cleaned = parseFloat(cleaned.replace(/m$/i, '')) * 1000000;
  } else if (/b$/i.test(cleaned)) {
    cleaned = parseFloat(cleaned.replace(/b$/i, '')) * 1000000000;
  } else {
    cleaned = parseFloat(cleaned);
  }
  
  return isNaN(cleaned) ? null : cleaned;
}

// Extract with context for debugging
export function extractWithContext(text, pattern, contextLength = 50) {
  const matches = [];
  let match;
  
  while ((match = pattern.exec(text)) !== null) {
    const start = Math.max(0, match.index - contextLength);
    const end = Math.min(text.length, match.index + match[0].length + contextLength);
    
    matches.push({
      value: match[0],
      captured: match[1] || match[2] || match[0],
      context: text.substring(start, end).replace(/\s+/g, ' ').trim(),
      index: match.index,
      pattern: pattern.source
    });
  }
  
  return matches;
}

// Multi-pass extraction strategy
export function multiPassExtraction(text, patterns, fieldName) {
  const results = [];
  const debugLog = [];
  
  // Pass 1: Try all specific patterns
  for (const pattern of patterns) {
    const matches = extractWithContext(text, pattern);
    if (matches.length > 0) {
      debugLog.push({
        pass: 1,
        pattern: pattern.source,
        matches: matches.length,
        samples: matches.slice(0, 3)
      });
      results.push(...matches);
    }
  }
  
  // Pass 2: If no results, try proximity search
  if (results.length === 0 && fieldName) {
    const proximityPattern = new RegExp(
      `${fieldName}[^$]*?\\$?\\s*([\\d,]+(?:\\.\\d+)?[kKmM]?)`,
      'gi'
    );
    const matches = extractWithContext(text, proximityPattern);
    if (matches.length > 0) {
      debugLog.push({
        pass: 2,
        strategy: 'proximity search',
        matches: matches.length
      });
      results.push(...matches);
    }
  }
  
  // Pass 3: General number extraction near keywords
  if (results.length === 0) {
    const generalPattern = /\$?\s*([\d,]+(?:\.\d+)?[kKmM]?)/g;
    const allNumbers = extractWithContext(text, generalPattern);
    const filtered = allNumbers.filter(match => {
      const lowerContext = match.context.toLowerCase();
      return lowerContext.includes(fieldName?.toLowerCase() || '');
    });
    
    if (filtered.length > 0) {
      debugLog.push({
        pass: 3,
        strategy: 'general numbers with keyword filter',
        matches: filtered.length
      });
      results.push(...filtered);
    }
  }
  
  return { results, debugLog };
}

// Extract financial data by year
export function extractByYear(text) {
  const yearData = {};
  const yearPattern = /(20\d{2})/g;
  const years = [...new Set(text.match(yearPattern) || [])].sort();
  
  years.forEach(year => {
    // Find all numbers near this year
    const yearRegex = new RegExp(
      `${year}[^$\\n]{0,100}\\$?\\s*([\\d,]+(?:\\.\\d+)?[kKmM]?)`,
      'gi'
    );
    const matches = extractWithContext(text, yearRegex);
    
    if (matches.length > 0) {
      yearData[year] = matches.map(m => ({
        value: cleanNumber(m.captured),
        context: m.context
      }));
    }
  });
  
  return yearData;
}

// Table extraction helper
export function extractTableData(text) {
  const tables = [];
  
  // Look for columnar data patterns
  const tablePattern = /([A-Za-z\s&]+?)\s+\$?([\d,]+(?:\.\d+)?[kKmM]?)\s*(?:\n|$)/g;
  let match;
  
  while ((match = tablePattern.exec(text)) !== null) {
    tables.push({
      label: match[1].trim(),
      value: cleanNumber(match[2]),
      raw: match[0]
    });
  }
  
  return tables;
}

// Aggressive extraction with validation
export function aggressiveExtract(text, fieldName, patterns, options = {}) {
  const { 
    minValue = 0,
    maxValue = Infinity,
    preferLarger = true,
    yearContext = null
  } = options;
  
  // Multi-pass extraction
  const { results, debugLog } = multiPassExtraction(text, patterns, fieldName);
  
  // Clean and validate results
  const validResults = results
    .map(r => ({
      ...r,
      cleanValue: cleanNumber(r.captured)
    }))
    .filter(r => r.cleanValue !== null && r.cleanValue >= minValue && r.cleanValue <= maxValue)
    .sort((a, b) => preferLarger ? b.cleanValue - a.cleanValue : a.cleanValue - b.cleanValue);
  
  // If year context provided, prefer results near that year
  if (yearContext && validResults.length > 1) {
    const yearFiltered = validResults.filter(r => 
      r.context.includes(yearContext.toString())
    );
    if (yearFiltered.length > 0) {
      return {
        value: yearFiltered[0].cleanValue,
        confidence: 'high',
        source: yearFiltered[0].context,
        debugLog
      };
    }
  }
  
  return {
    value: validResults.length > 0 ? validResults[0].cleanValue : null,
    confidence: validResults.length > 0 ? 'medium' : 'none',
    source: validResults.length > 0 ? validResults[0].context : null,
    allResults: validResults,
    debugLog
  };
}