import { config } from 'dotenv';

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
    
    const analysisResult = await analyzeWithClaude(fileBuffer, fileName, prompt);
    
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

async function analyzeWithClaude(fileBuffer, fileName, prompt) {
  if (!process.env.CLAUDE_API_KEY) {
    throw new Error('Claude API key not configured. Please add CLAUDE_API_KEY to your environment variables.');
  }

  try {
    console.log('Sending PDF directly to Claude API...');
    console.log('API Key available:', !!process.env.CLAUDE_API_KEY);
    console.log('PDF file size:', fileBuffer.length, 'bytes');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'text',
              text: `Please analyze this PDF document. The PDF content is provided as base64: ${fileBuffer.toString('base64')}`
            }
          ]
        }]
      })
    });
    
    console.log('Claude API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error response:', errorText);
      throw new Error(`Claude API request failed (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    
    if (result.error) {
      throw new Error(`Claude API error: ${result.error.message || 'Unknown error'}`);
    }
    
    if (!result.content || !result.content[0] || !result.content[0].text) {
      throw new Error('Invalid response format from Claude API');
    }
    
    console.log('Claude API raw response:', result.content[0].text);
    
    try {
      const parsedResult = JSON.parse(result.content[0].text);
      console.log('Parsed JSON result:', JSON.stringify(parsedResult, null, 2));
      console.log('Purchase price from response:', parsedResult.purchasePrice);
      console.log('Quick stats from response:', parsedResult.quickStats);
      return parsedResult;
    } catch (parseError) {
      // If JSON parsing fails, try to extract JSON from the response
      const text = result.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e) {
          throw new Error(`Failed to parse extracted JSON: ${e.message}`);
        }
      }
      throw new Error(`Failed to parse Claude response as JSON: ${parseError.message}. Response was: ${text}`);
    }
  } catch (error) {
    console.error('Claude API error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause
    });
    
    if (error.message.includes('fetch')) {
      throw new Error(`Network error connecting to Claude API: ${error.message}. Please check your internet connection and try again.`);
    }
    
    throw error;
  }
}