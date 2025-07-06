import { config } from 'dotenv';
import pdf from 'pdf-parse';

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

async function analyzeWithOpenAI(fileBuffer, fileName, prompt) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.');
  }

  try {
    console.log('🤖 === STARTING OPENAI GPT-4O ANALYSIS ===');
    console.log('📄 Extracting text from PDF...');
    console.log('📏 PDF file size:', fileBuffer.length, 'bytes');
    
    // Extract text from PDF
    const pdfData = await pdf(fileBuffer);
    const extractedText = pdfData.text;
    
    console.log('📝 Extracted text length:', extractedText.length, 'characters');
    console.log('🔍 First 500 chars:', extractedText.substring(0, 500));
    
    // Send to OpenAI GPT-4o
    console.log('🚀 Sending to OpenAI GPT-4o API...');
    console.log('🤖 Model: gpt-4o');
    console.log('🔑 API Key configured:', !!openaiApiKey);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: `${prompt}\n\nDocument content extracted from "${fileName}":\n\n${extractedText}`
        }],
        max_tokens: 8000,
        temperature: 0.1
      })
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
    console.log('OpenAI API raw response:', responseText);
    
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