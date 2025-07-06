import { config } from 'dotenv';
import pdf from 'pdf-parse';
import PDFParser from 'pdf2json';
import { PDFDocument } from 'pdf-lib';

// Load environment variables
config({ path: '.env.local' });

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, fileName, file, images, useImageExtraction } = req.body;
    
    let analysisResult;
    
    if (useImageExtraction && images && images.length > 0) {
      // Use image-based extraction for better accuracy
      console.log(`🖼️ Using image-based extraction with ${images.length} pages`);
      analysisResult = await analyzeImagesWithOpenAI(images, fileName, prompt);
    } else if (file) {
      // Fall back to text extraction
      console.log('📄 Using text-based extraction');
      const fileBuffer = Buffer.from(file, 'base64');
      analysisResult = await analyzeWithOpenAI(fileBuffer, fileName, prompt);
    } else {
      return res.status(400).json({ error: 'No file or images provided' });
    }
    
    res.json({
      success: true,
      data: analysisResult
    });
    
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze document',
      message: error.message 
    });
  }
}

async function extractTextWithStructuredParser(fileBuffer) {
  try {
    console.log('📄 Starting structured PDF text extraction...');
    
    let extractedText = '';
    let pdfData = null;
    
    // Try pdf-parse first
    try {
      pdfData = await pdf(fileBuffer);
      extractedText = pdfData.text;
      console.log('✅ pdf-parse extraction successful');
      
      // Check if we got meaningful text
      const meaningfulText = extractedText.replace(/\s+/g, '').length > 100 && 
                           extractedText.match(/\d{4,}/g)?.length > 5; // Should have numbers
      
      if (!meaningfulText) {
        console.log('⚠️ Text extraction seems incomplete, trying OCR approach...');
        throw new Error('Insufficient text extracted');
      }
    } catch (parseError) {
      console.log('⚠️ Standard extraction failed, trying advanced methods...', parseError.message);
      
      // Try alternative extraction methods
      try {
        console.log('🔄 Trying alternative extraction methods...');
        extractedText = await extractWithPDFLib(fileBuffer);
        console.log('✅ Alternative extraction successful');
      } catch (altError) {
        console.log('⚠️ Alternative extraction failed, trying pdf2json...', altError.message);
        
        // Final fallback to pdf2json
        const pdfParser = new PDFParser();
        
        extractedText = await new Promise((resolve, reject) => {
          pdfParser.on('pdfParser_dataError', errData => reject(errData.parserError));
          pdfParser.on('pdfParser_dataReady', pdfData => {
            let text = '';
            pdfData.Pages.forEach(page => {
              page.Texts.forEach(textItem => {
                textItem.R.forEach(r => {
                  if (r.T) {
                    text += decodeURIComponent(r.T) + ' ';
                  }
                });
              });
              text += '\n\n';
            });
            resolve(text);
          });
          
          pdfParser.parseBuffer(fileBuffer);
        });
        
        console.log('✅ pdf2json extraction successful');
      }
    }
    
    console.log('📝 Raw text length:', extractedText.length, 'characters');
    if (pdfData) {
      console.log('📄 Number of pages:', pdfData.numpages);
      console.log('📊 PDF metadata:', pdfData.info);
    }
    
    // Clean and structure the text for better financial data extraction
    extractedText = extractedText
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
      .replace(/\$\s+/g, '$') // Fix currency formatting
      .replace(/(\d)\s+(\d{3})/g, '$1$2') // Fix number formatting
      .replace(/\s*\n\s*/g, '\n') // Clean up newlines
      .trim();
    
    console.log('🔍 First 1000 chars of cleaned text:', extractedText.substring(0, 1000));
    console.log('📊 Looking for financial indicators...');
    
    // Look for financial data patterns
    const revenueMatch = extractedText.match(/revenue[^\d]*(\$?[\d,]+(?:\.\d+)?(?:[MmKk])?)/gi);
    const ebitdaMatch = extractedText.match(/ebitda[^\d]*(\$?[\d,]+(?:\.\d+)?(?:[MmKk])?)/gi);
    const yearMatches = extractedText.match(/20\d{2}/g);
    
    console.log('💰 Revenue indicators found:', revenueMatch);
    console.log('💵 EBITDA indicators found:', ebitdaMatch);
    console.log('📅 Years found:', yearMatches);
    
    // Enhanced extraction with table detection
    const lines = extractedText.split('\n');
    console.log('📑 Total lines:', lines.length);
    
    // Log lines that might contain financial data
    lines.forEach((line, index) => {
      if (line.match(/\$[\d,]+|\d{4}.*\d{4}|revenue|ebitda|income|profit|cash/i)) {
        console.log(`Line ${index}: ${line}`);
      }
    });
    
    console.log('\n🔍 === FULL EXTRACTED TEXT ===');
    console.log(extractedText);
    console.log('=== END OF EXTRACTED TEXT ===\n');
    
    return extractedText;
  } catch (error) {
    console.error('❌ PDF extraction failed:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

async function extractWithPDFLib(fileBuffer) {
  try {
    console.log('🔧 Trying pdf-lib for structured extraction...');
    const pdfDoc = await PDFDocument.load(fileBuffer);
    const pages = pdfDoc.getPages();
    
    console.log(`📄 PDF has ${pages.length} pages`);
    
    // Try to extract form fields which might contain structured data
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    console.log(`📋 Found ${fields.length} form fields`);
    
    fields.forEach(field => {
      const name = field.getName();
      console.log(`Field: ${name}`);
    });
    
    // For now, fall back to regular extraction
    throw new Error('PDF-lib extraction not fully implemented');
  } catch (error) {
    console.error('PDF-lib extraction failed:', error);
    throw error;
  }
}

async function analyzeImagesWithOpenAI(images, fileName, prompt) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.');
  }

  try {
    console.log('🖼️ === STARTING OPENAI GPT-4O IMAGE ANALYSIS ===');
    console.log('📄 Document:', fileName);
    console.log('🖼️ Number of images:', images.length);
    console.log('📏 Total image data size:', images.reduce((sum, img) => sum + img.length, 0) / 1024 / 1024, 'MB');
    
    // Create content array with text prompt and images
    const content = [
      {
        type: 'text',
        text: prompt + '\n\nIMPORTANT: Return ONLY valid JSON with no additional text or explanation.'
      }
    ];
    
    // Add each image
    images.forEach((imageBase64, index) => {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${imageBase64}`,
          detail: 'high' // Use high detail for better extraction
        }
      });
      console.log(`📄 Added page ${index + 1} to analysis`);
    });
    
    console.log('🚀 Sending to OpenAI GPT-4 Vision API...');
    
    const requestBody = {
      model: 'gpt-4o', // GPT-4 with vision capabilities
      messages: [{
        role: 'user',
        content: content
      }],
      max_tokens: 4096,
      temperature: 0.1
    };
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('OpenAI API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error response:', errorText);
      throw new Error(`OpenAI API request failed (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    
    if (result.error) {
      throw new Error(`OpenAI API error: ${result.error.message || 'Unknown error'}`);
    }
    
    const responseText = result.choices[0].message.content;
    console.log('🤖 === OPENAI VISION RESPONSE ===');
    console.log('📊 Response length:', responseText.length, 'characters');
    console.log('🔍 Full response:', responseText);
    console.log('💰 Usage stats:', result.usage);
    console.log('==================================');
    
    try {
      const parsedResult = JSON.parse(responseText);
      
      // Add model metadata to the response
      parsedResult.modelInfo = {
        provider: 'OpenAI',
        model: 'gpt-4o-vision',
        analysisTimestamp: new Date().toISOString(),
        extractionMethod: 'Image-based OCR',
        pageCount: images.length
      };
      
      console.log('=== OpenAI GPT-4 Vision Analysis Complete ===');
      console.log('Parsed JSON result:', JSON.stringify(parsedResult, null, 2));
      console.log('=======================================');
      
      return parsedResult;
    } catch (parseError) {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const fallbackResult = JSON.parse(jsonMatch[0]);
          fallbackResult.modelInfo = {
            provider: 'OpenAI',
            model: 'gpt-4o-vision',
            analysisTimestamp: new Date().toISOString(),
            extractionMethod: 'Image-based OCR',
            pageCount: images.length,
            fallbackParsing: true
          };
          return fallbackResult;
        } catch (e) {
          throw new Error(`Failed to parse extracted JSON: ${e.message}`);
        }
      }
      throw new Error(`Failed to parse OpenAI response as JSON: ${parseError.message}. Response was: ${responseText}`);
    }
  } catch (error) {
    console.error('OpenAI Vision API error:', error);
    throw error;
  }
}

async function analyzeWithOpenAI(fileBuffer, fileName, prompt) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.');
  }

  try {
    console.log('🤖 === STARTING OPENAI GPT-4O ANALYSIS ===');
    console.log('📄 Extracting text from PDF using PDF.js...');
    console.log('📏 PDF file size:', fileBuffer.length, 'bytes');
    
    // Extract text from PDF with enhanced parsing
    const extractedText = await extractTextWithStructuredParser(fileBuffer);
    
    console.log('📝 Extracted text length:', extractedText.length, 'characters');
    console.log('🔍 First 500 chars:', extractedText.substring(0, 500));
    console.log('🔍 Full extracted text:', extractedText);
    
    // Send to OpenAI GPT-4o
    console.log('🚀 Sending to OpenAI GPT-4o API...');
    console.log('🤖 Model: gpt-4o');
    console.log('🔑 API Key configured:', !!openaiApiKey);
    
    // Enhanced prompt that helps OpenAI understand table structures better
    const enhancedPrompt = `${prompt}

IMPORTANT EXTRACTION INSTRUCTIONS:
1. The document may contain financial tables with years as column headers and metrics as row headers
2. Look for patterns like:
   - Revenue/Sales rows with values across multiple year columns
   - EBITDA/Adjusted EBITDA rows with corresponding values
   - Financial statements in tabular format
3. When you see year numbers (2021, 2022, 2023, etc.), look for the corresponding values in the same row/column
4. Pay special attention to:
   - Dollar amounts (may appear as $X,XXX or just numbers)
   - Percentages (X% or X.X%)
   - Table structures where years are headers and financial metrics are in rows below

Document content extracted from "${fileName}":

${extractedText}

EXTRACTION TIPS:
- If you see "2021 2022 2023" these are likely column headers
- Look for the actual dollar amounts that correspond to these years
- Financial data often appears in structured tables
- Values might be separated by spaces or tabs
- Numbers might include commas (e.g., 1,234,567) or abbreviations (e.g., 1.2M)`;
    
    const fullPrompt = enhancedPrompt;
    
    console.log('📝 === FULL PROMPT BEING SENT ===');
    console.log('📄 Prompt length:', fullPrompt.length, 'characters');
    console.log('🎯 Prompt preview (first 1000 chars):', fullPrompt.substring(0, 1000));
    console.log('📊 Extracted text preview (first 2000 chars):', extractedText.substring(0, 2000));
    console.log('================================');
    
    const requestBody = {
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: fullPrompt
      }],
      max_tokens: 8000,
      temperature: 0.1
    };
    
    console.log('🔗 Request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('OpenAI API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error response:', errorText);
      throw new Error(`OpenAI API request failed (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    
    if (result.error) {
      throw new Error(`OpenAI API error: ${result.error.message || 'Unknown error'}`);
    }
    
    if (!result.choices || !result.choices[0] || !result.choices[0].message || !result.choices[0].message.content) {
      throw new Error('Invalid response format from OpenAI API');
    }
    
    const responseText = result.choices[0].message.content;
    console.log('🤖 === OPENAI RESPONSE DETAILS ===');
    console.log('📊 Response length:', responseText.length, 'characters');
    console.log('🔍 Full response:', responseText);
    console.log('💰 Usage stats:', result.usage);
    console.log('🎯 Model used:', result.model);
    console.log('==================================');
    
    try {
      const parsedResult = JSON.parse(responseText);
      
      // Add model metadata to the response
      parsedResult.modelInfo = {
        provider: 'OpenAI',
        model: 'gpt-4o',
        analysisTimestamp: new Date().toISOString(),
        extractedTextLength: extractedText.length
      };
      
      console.log('=== OpenAI GPT-4o Analysis Complete ===');
      console.log('Model used:', 'gpt-4o');
      console.log('Provider:', 'OpenAI');
      console.log('Parsed JSON result:', JSON.stringify(parsedResult, null, 2));
      console.log('Purchase price from response:', parsedResult.purchasePrice);
      console.log('Quick stats from response:', parsedResult.quickStats);
      console.log('=======================================');
      
      return parsedResult;
    } catch (parseError) {
      // If JSON parsing fails, try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const fallbackResult = JSON.parse(jsonMatch[0]);
          // Add model metadata to fallback result too
          fallbackResult.modelInfo = {
            provider: 'OpenAI',
            model: 'gpt-4o',
            analysisTimestamp: new Date().toISOString(),
            extractedTextLength: extractedText.length,
            fallbackParsing: true
          };
          console.log('=== OpenAI GPT-4o Analysis Complete (Fallback) ===');
          return fallbackResult;
        } catch (e) {
          throw new Error(`Failed to parse extracted JSON: ${e.message}`);
        }
      }
      throw new Error(`Failed to parse OpenAI response as JSON: ${parseError.message}. Response was: ${responseText}`);
    }
  } catch (error) {
    console.error('OpenAI API error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause
    });
    
    if (error.message.includes('fetch')) {
      throw new Error(`Network error connecting to OpenAI API: ${error.message}. Please check your internet connection and try again.`);
    }
    
    throw error;
  }
}
// Important: Increase body size limit for base64 images
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};
