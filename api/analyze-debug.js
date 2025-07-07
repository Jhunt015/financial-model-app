// Debug API for understanding extraction issues
// This endpoint provides detailed debugging information about what's being extracted

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
    console.log('🔍 DEBUG MODE: Starting comprehensive document analysis');
    
    const { images, fileData, fileName } = req.body;

    if (!images && !fileData) {
      return res.status(400).json({
        error: 'No data provided',
        message: 'Either images or fileData is required'
      });
    }

    // Step 1: Extract raw text from all pages
    console.log('📄 Step 1: Extracting raw text from document...');
    const rawText = await extractRawText(images, fileData, fileName);
    
    // Step 2: Find all numbers and financial patterns
    console.log('💰 Step 2: Finding all numbers and financial patterns...');
    const financialPatterns = findFinancialPatterns(rawText);
    
    // Step 3: Try to identify table structures
    console.log('📊 Step 3: Identifying table structures...');
    const tableStructures = identifyTableStructures(rawText);
    
    // Step 4: Apply targeted extraction for specific sections
    console.log('🎯 Step 4: Targeted extraction of financial sections...');
    const targetedExtraction = await performTargetedExtraction(rawText);
    
    // Step 5: Use AI to interpret the document
    console.log('🧠 Step 5: AI interpretation of document content...');
    const aiInterpretation = await performAIInterpretation(rawText, financialPatterns);
    
    // Compile comprehensive debug report
    const debugReport = {
      fileName: fileName,
      timestamp: new Date().toISOString(),
      documentInfo: {
        totalCharacters: rawText.length,
        totalLines: rawText.split('\n').length,
        hasImages: !!images,
        imageCount: images?.length || 0
      },
      rawTextSample: {
        first1000: rawText.substring(0, 1000),
        last1000: rawText.substring(Math.max(0, rawText.length - 1000))
      },
      financialPatterns: financialPatterns,
      tableStructures: tableStructures,
      targetedExtraction: targetedExtraction,
      aiInterpretation: aiInterpretation,
      extractionIssues: identifyExtractionIssues(rawText, financialPatterns)
    };

    console.log('✅ Debug analysis complete');
    
    return res.status(200).json({
      success: true,
      debugReport: debugReport
    });

  } catch (error) {
    console.error('❌ Debug API Error:', error);
    
    return res.status(500).json({
      error: 'Debug analysis failed',
      message: error.message,
      stack: error.stack
    });
  }
}

// Extract raw text from document
async function extractRawText(images, fileData, fileName) {
  let allText = '';
  
  if (images && images.length > 0) {
    // Use OCR on images
    console.log(`Processing ${images.length} images...`);
    
    for (let i = 0; i < Math.min(images.length, 10); i++) {
      try {
        const pageText = await extractTextFromImage(images[i], i + 1);
        allText += `\n\n--- PAGE ${i + 1} ---\n${pageText}`;
      } catch (err) {
        console.error(`Failed to extract from page ${i + 1}:`, err);
      }
    }
  } else if (fileData) {
    // Try text extraction from PDF
    try {
      const response = await fetch('https://analyst.ebitcommunity.com/api/analyze-text-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData, fileName })
      });
      
      if (response.ok) {
        const result = await response.json();
        allText = result.extractedText || 'No text extracted';
      }
    } catch (err) {
      console.error('Text extraction failed:', err);
    }
  }
  
  return allText || 'No text could be extracted';
}

// Extract text from image using OCR
async function extractTextFromImage(imageBase64, pageNumber) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract ALL text from this image exactly as it appears. Include all numbers, tables, and financial data. Preserve the layout as much as possible.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'high'
              }
            }
          ]
        }],
        max_tokens: 4096,
        temperature: 0
      })
    });

    if (!response.ok) {
      throw new Error(`OCR failed: ${response.status}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;
  } catch (error) {
    console.error('OCR error:', error);
    return `[OCR failed for page ${pageNumber}]`;
  }
}

// Find all financial patterns in the text
function findFinancialPatterns(text) {
  const patterns = {
    // Currency amounts
    currencyAmounts: [],
    // Percentages
    percentages: [],
    // Years
    years: [],
    // Financial keywords
    financialKeywords: [],
    // Table headers
    tableHeaders: [],
    // Revenue indicators
    revenueIndicators: [],
    // EBITDA indicators
    ebitdaIndicators: []
  };
  
  // Find currency amounts (various formats)
  const currencyRegex = /\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|M|MM|thousand|K|billion|B))?/gi;
  const currencyMatches = text.match(currencyRegex) || [];
  patterns.currencyAmounts = currencyMatches.map(match => ({
    raw: match,
    value: parseCurrencyValue(match),
    context: getContext(text, match)
  }));
  
  // Find percentages
  const percentRegex = /\d+(?:\.\d+)?%/g;
  const percentMatches = text.match(percentRegex) || [];
  patterns.percentages = percentMatches.map(match => ({
    raw: match,
    value: parseFloat(match),
    context: getContext(text, match)
  }));
  
  // Find years
  const yearRegex = /\b20\d{2}\b/g;
  const yearMatches = text.match(yearRegex) || [];
  patterns.years = [...new Set(yearMatches)].sort();
  
  // Find financial keywords with line context
  const financialTerms = [
    'revenue', 'sales', 'income', 'ebitda', 'gross profit', 'operating expenses',
    'net income', 'cash flow', 'commission', 'cost of goods', 'cogs',
    'gross margin', 'operating margin', 'adjusted ebitda', 'normalized ebitda'
  ];
  
  financialTerms.forEach(term => {
    const regex = new RegExp(`^.*${term}.*$`, 'gmi');
    const matches = text.match(regex) || [];
    patterns.financialKeywords.push(...matches.map(line => ({
      term: term,
      line: line.trim(),
      numbers: extractNumbersFromLine(line)
    })));
  });
  
  // Find table headers (lines with multiple years)
  const lines = text.split('\n');
  lines.forEach(line => {
    const yearCount = (line.match(/\b20\d{2}\b/g) || []).length;
    if (yearCount >= 2) {
      patterns.tableHeaders.push({
        line: line.trim(),
        years: line.match(/\b20\d{2}\b/g)
      });
    }
  });
  
  // Find revenue lines
  const revenueRegex = /^.*(revenue|sales|income|commission).*\$[\d,]+.*$/gmi;
  const revenueMatches = text.match(revenueRegex) || [];
  patterns.revenueIndicators = revenueMatches.map(line => ({
    line: line.trim(),
    amounts: extractAmountsFromLine(line)
  }));
  
  // Find EBITDA lines
  const ebitdaRegex = /^.*ebitda.*\$[\d,]+.*$/gmi;
  const ebitdaMatches = text.match(ebitdaRegex) || [];
  patterns.ebitdaIndicators = ebitdaMatches.map(line => ({
    line: line.trim(),
    amounts: extractAmountsFromLine(line)
  }));
  
  return patterns;
}

// Get context around a match
function getContext(text, match, contextLength = 100) {
  const index = text.indexOf(match);
  const start = Math.max(0, index - contextLength);
  const end = Math.min(text.length, index + match.length + contextLength);
  return text.substring(start, end).replace(/\n/g, ' ').trim();
}

// Parse currency value
function parseCurrencyValue(currencyString) {
  let value = currencyString.replace(/[$,]/g, '');
  
  // Handle multipliers
  if (/million|M|MM/i.test(value)) {
    value = parseFloat(value) * 1000000;
  } else if (/thousand|K/i.test(value)) {
    value = parseFloat(value) * 1000;
  } else if (/billion|B/i.test(value)) {
    value = parseFloat(value) * 1000000000;
  } else {
    value = parseFloat(value);
  }
  
  return isNaN(value) ? null : value;
}

// Extract numbers from a line
function extractNumbersFromLine(line) {
  const numbers = [];
  const numberRegex = /[\d,]+(?:\.\d+)?/g;
  const matches = line.match(numberRegex) || [];
  
  matches.forEach(match => {
    const num = parseFloat(match.replace(/,/g, ''));
    if (!isNaN(num)) {
      numbers.push(num);
    }
  });
  
  return numbers;
}

// Extract currency amounts from a line
function extractAmountsFromLine(line) {
  const amounts = [];
  const currencyRegex = /\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|M|MM|thousand|K))?/gi;
  const matches = line.match(currencyRegex) || [];
  
  matches.forEach(match => {
    const value = parseCurrencyValue(match);
    if (value) {
      amounts.push({
        raw: match,
        value: value
      });
    }
  });
  
  return amounts;
}

// Identify table structures
function identifyTableStructures(text) {
  const tables = [];
  const lines = text.split('\n');
  
  // Look for patterns that indicate tables
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if line has multiple columns (tabs or multiple spaces)
    const hasMultipleColumns = /\t/.test(line) || /\s{3,}/.test(line);
    
    // Check if line has years
    const hasYears = /\b20\d{2}\b.*\b20\d{2}\b/.test(line);
    
    if (hasMultipleColumns || hasYears) {
      // Look for table continuation
      const tableLines = [line];
      let j = i + 1;
      
      while (j < lines.length && j < i + 20) {
        const nextLine = lines[j];
        if (/\$[\d,]+|[\d,]+(?:\.\d+)?%|\b\d{1,3}(?:,\d{3})*\b/.test(nextLine)) {
          tableLines.push(nextLine);
        } else if (nextLine.trim() === '') {
          break;
        }
        j++;
      }
      
      if (tableLines.length > 2) {
        tables.push({
          startLine: i,
          endLine: i + tableLines.length,
          content: tableLines.join('\n'),
          possibleType: identifyTableType(tableLines.join('\n'))
        });
        i = j; // Skip processed lines
      }
    }
  }
  
  return tables;
}

// Identify table type
function identifyTableType(tableContent) {
  const content = tableContent.toLowerCase();
  
  if (/income statement|profit.loss|p&l|revenue.*expense/.test(content)) {
    return 'income_statement';
  } else if (/balance sheet|assets.*liabilities/.test(content)) {
    return 'balance_sheet';
  } else if (/cash flow|operating activities/.test(content)) {
    return 'cash_flow';
  } else if (/financial highlights|key metrics/.test(content)) {
    return 'metrics';
  } else {
    return 'unknown';
  }
}

// Perform targeted extraction
async function performTargetedExtraction(text) {
  const extraction = {
    revenue: {},
    ebitda: {},
    expenses: {},
    netIncome: {},
    otherMetrics: {}
  };
  
  // Extract revenue by year
  const revenueSection = findSection(text, ['revenue', 'sales', 'income']);
  if (revenueSection) {
    extraction.revenue = extractYearlyValues(revenueSection);
  }
  
  // Extract EBITDA by year
  const ebitdaSection = findSection(text, ['ebitda', 'adjusted ebitda']);
  if (ebitdaSection) {
    extraction.ebitda = extractYearlyValues(ebitdaSection);
  }
  
  // Extract expenses
  const expenseSection = findSection(text, ['operating expenses', 'expenses', 'costs']);
  if (expenseSection) {
    extraction.expenses = extractYearlyValues(expenseSection);
  }
  
  // Extract net income
  const netIncomeSection = findSection(text, ['net income', 'net profit']);
  if (netIncomeSection) {
    extraction.netIncome = extractYearlyValues(netIncomeSection);
  }
  
  return extraction;
}

// Find section containing keywords
function findSection(text, keywords, contextLines = 10) {
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (keywords.some(keyword => line.includes(keyword))) {
      // Get surrounding lines
      const start = Math.max(0, i - contextLines);
      const end = Math.min(lines.length, i + contextLines);
      return lines.slice(start, end).join('\n');
    }
  }
  
  return null;
}

// Extract yearly values from a section
function extractYearlyValues(section) {
  const values = {};
  const years = section.match(/\b20\d{2}\b/g) || [];
  
  years.forEach(year => {
    // Look for values associated with this year
    const yearRegex = new RegExp(`${year}[^\\n]*\\$[\\d,]+(?:\\.\\d{2})?(?:\\s*(?:million|M))?`, 'gi');
    const matches = section.match(yearRegex) || [];
    
    if (matches.length > 0) {
      const amounts = matches[0].match(/\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|M))?/gi) || [];
      if (amounts.length > 0) {
        values[year] = parseCurrencyValue(amounts[0]);
      }
    }
  });
  
  return values;
}

// Use AI to interpret the document
async function performAIInterpretation(text, patterns) {
  const prompt = `Analyze this financial document text and extract specific numerical values.

DOCUMENT TEXT (first 3000 chars):
${text.substring(0, 3000)}

FINANCIAL PATTERNS FOUND:
- Years: ${patterns.years.join(', ')}
- Currency amounts found: ${patterns.currencyAmounts.slice(0, 20).map(a => a.raw).join(', ')}
- Revenue lines: ${patterns.revenueIndicators.slice(0, 5).map(r => r.line).join('\n')}
- EBITDA lines: ${patterns.ebitdaIndicators.slice(0, 5).map(e => e.line).join('\n')}

Please extract and return ONLY the following in JSON format:
{
  "revenue": {
    "2021": [number or null],
    "2022": [number or null],
    "2023": [number or null],
    "2024": [number or null]
  },
  "ebitda": {
    "2021": [number or null],
    "2022": [number or null],
    "2023": [number or null],
    "2024": [number or null]
  },
  "grossProfit": {
    "2021": [number or null],
    "2022": [number or null],
    "2023": [number or null],
    "2024": [number or null]
  },
  "operatingExpenses": {
    "2021": [number or null],
    "2022": [number or null],
    "2023": [number or null],
    "2024": [number or null]
  },
  "netIncome": {
    "2021": [number or null],
    "2022": [number or null],
    "2023": [number or null],
    "2024": [number or null]
  },
  "askingPrice": [number or null],
  "extractionNotes": "Brief explanation of what values were found and any issues"
}

IMPORTANT: 
- Convert all values to actual numbers (e.g., "$5.2 million" becomes 5200000)
- Use null if a value is not found
- Include projected/estimated years if marked with "E" (e.g., 2024E)`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: 1000,
        temperature: 0
      })
    });

    if (!response.ok) {
      throw new Error(`AI interpretation failed: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    
    // Try to parse JSON from response
    try {
      return JSON.parse(content);
    } catch (e) {
      // Extract JSON from response if wrapped in text
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { error: 'Could not parse AI response', raw: content };
    }
  } catch (error) {
    console.error('AI interpretation error:', error);
    return { error: error.message };
  }
}

// Identify extraction issues
function identifyExtractionIssues(text, patterns) {
  const issues = [];
  
  // Check if document is image-based
  if (text.length < 1000) {
    issues.push('Document appears to have very little text - may be image-based');
  }
  
  // Check if financial data is in tables
  if (patterns.currencyAmounts.length < 5) {
    issues.push('Very few currency amounts found - data may be in complex tables');
  }
  
  // Check if years are found
  if (patterns.years.length < 2) {
    issues.push('Few year references found - temporal data may be formatted differently');
  }
  
  // Check for table indicators
  if (!text.includes('\t') && !/\s{5,}/.test(text)) {
    issues.push('No clear table structure detected - data may be in images or complex layouts');
  }
  
  // Check for financial keywords
  if (patterns.financialKeywords.length < 5) {
    issues.push('Few financial keywords found - document may use non-standard terminology');
  }
  
  return issues;
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