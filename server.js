import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import { config } from 'dotenv';
import pdf from 'pdf-parse';

config({ path: '.env.local' });

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// OpenAI API endpoint
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
});

async function analyzeWithOpenAI(fileBuffer, fileName, prompt) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.');
  }

  try {
    console.log('Extracting text from PDF...');
    console.log('PDF file size:', fileBuffer.length, 'bytes');
    
    // Extract text from PDF
    const pdfData = await pdf(fileBuffer);
    const extractedText = pdfData.text;
    
    console.log('Extracted text length:', extractedText.length, 'characters');
    console.log('First 500 chars:', extractedText.substring(0, 500));
    
    // Send to OpenAI GPT-4o
    console.log('Sending to OpenAI GPT-4o...');
    
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
      console.log('Parsed JSON result:', JSON.stringify(parsedResult, null, 2));
      console.log('Purchase price from response:', parsedResult.purchasePrice);
      console.log('Quick stats from response:', parsedResult.quickStats);
      return parsedResult;
    } catch (parseError) {
      // If JSON parsing fails, try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
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
  } finally {
    // No cleanup needed since we're processing in memory
    console.log('PDF analysis completed');
  }
}


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`OpenAI GPT-4o analysis server running on port ${PORT}`);
});