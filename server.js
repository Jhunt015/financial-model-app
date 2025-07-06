import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import { config } from 'dotenv';

config({ path: '.env.local' });

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Claude API endpoint
app.post('/api/analyze-document', upload.single('file'), async (req, res) => {
  try {
    const { prompt, fileName } = req.body;
    
    // If file is uploaded via multipart
    let fileBuffer;
    if (req.file) {
      fileBuffer = await fs.readFile(req.file.path);
      // Clean up uploaded file
      await fs.unlink(req.file.path);
    } else if (req.body.file) {
      // If file is sent as base64
      fileBuffer = Buffer.from(req.body.file, 'base64');
    } else {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Convert PDF to images if needed (for now, we'll simulate the analysis)
    // In production, you'd use pdf-poppler or similar to convert PDF to images
    
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
});

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
  } finally {
    // No cleanup needed since we're processing in memory
    console.log('PDF analysis completed');
  }
}


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Claude analysis server running on port ${PORT}`);
});