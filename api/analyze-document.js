import { config } from 'dotenv';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.js';

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
    const { prompt, fileName, file } = req.body;
    
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Convert base64 file to buffer
    const fileBuffer = Buffer.from(file, 'base64');
    
    const analysisResult = await analyzeWithOpenAI(fileBuffer, fileName, prompt);
    
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

async function extractTextWithPDFJS(fileBuffer) {
  try {
    // Load PDF document
    const pdfDocument = await pdfjs.getDocument({
      data: fileBuffer,
      useSystemFonts: true,
      verbosity: 0
    }).promise;
    
    console.log('📄 PDF loaded successfully. Pages:', pdfDocument.numPages);
    
    let fullText = '';
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine all text items from the page
      let pageText = '';
      for (const item of textContent.items) {
        if (item.str) {
          pageText += item.str + ' ';
        }
      }
      
      console.log(`📃 Page ${pageNum} text length:`, pageText.length);
      console.log(`📃 Page ${pageNum} preview:`, pageText.substring(0, 200));
      
      fullText += `\n\n--- Page ${pageNum} ---\n${pageText}`;
    }
    
    console.log('✅ PDF.js extraction complete. Total text length:', fullText.length);
    return fullText;
  } catch (error) {
    console.error('❌ PDF.js extraction failed:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
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
    
    // Extract text from PDF using PDF.js
    const extractedText = await extractTextWithPDFJS(fileBuffer);
    
    console.log('📝 Extracted text length:', extractedText.length, 'characters');
    console.log('🔍 First 500 chars:', extractedText.substring(0, 500));
    console.log('🔍 Full extracted text:', extractedText);
    
    // Send to OpenAI GPT-4o
    console.log('🚀 Sending to OpenAI GPT-4o API...');
    console.log('🤖 Model: gpt-4o');
    console.log('🔑 API Key configured:', !!openaiApiKey);
    
    const fullPrompt = `${prompt}\n\nDocument content extracted from "${fileName}":\n\n${extractedText}`;
    
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