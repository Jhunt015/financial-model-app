export default async function handler(req, res) {
  try {
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

    console.log('=== SIMPLE API REQUEST ===');
    console.log('Environment check:', {
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      keyLength: process.env.OPENAI_API_KEY?.length || 0
    });

    const { images, fileName, useImageExtraction } = req.body || {};
    
    console.log('Request data:', {
      hasImages: !!images,
      imageCount: images?.length || 0,
      fileName,
      useImageExtraction
    });

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'OpenAI API key not configured',
        message: 'Please check environment variables'
      });
    }

    if (!images || images.length === 0) {
      return res.status(400).json({
        error: 'No images provided',
        message: 'Image extraction requires at least one image'
      });
    }

    console.log('Attempting OpenAI API call...');

    // Simple OpenAI API test
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
              text: 'Extract any text and financial data from these images. Return as JSON.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${images[0]}`,
                detail: 'high'
              }
            }
          ]
        }],
        max_tokens: 1000,
        temperature: 0.1
      })
    });

    console.log('OpenAI response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI error:', errorText);
      return res.status(500).json({
        error: 'OpenAI API error',
        message: `API returned ${response.status}: ${errorText}`,
        details: { status: response.status }
      });
    }

    const result = await response.json();
    console.log('OpenAI success');

    res.json({
      success: true,
      message: 'Simple API test successful',
      data: {
        response: result.choices[0].message.content,
        usage: result.usage
      }
    });

  } catch (error) {
    console.error('=== SIMPLE API ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    res.status(500).json({
      error: 'Simple API failed',
      message: error.message,
      type: error.constructor.name
    });
  }
}