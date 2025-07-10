// Vercel serverless function to test Grok API key
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('🔍 Testing Grok API from Vercel environment...');
    
    // Check if API key is available
    if (!process.env.XAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'XAI_API_KEY environment variable not found',
        message: 'API key not configured in Vercel environment variables'
      });
    }
    
    const apiKey = process.env.XAI_API_KEY;
    console.log('🔑 API Key found, length:', apiKey.length);
    console.log('🔑 API Key prefix:', apiKey.substring(0, 10) + '...');
    
    // Test basic text completion
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'grok-beta',
        messages: [
          { 
            role: 'user', 
            content: 'Hello! Please respond with "API test successful" if you can see this message.' 
          }
        ],
        max_tokens: 50,
        temperature: 0.1
      })
    });
    
    console.log('📊 Grok API Response Status:', response.status);
    console.log('📋 Response Headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Grok API Error:', errorText);
      
      let errorType = 'Unknown error';
      if (response.status === 401) {
        errorType = 'Authentication failed - Invalid API key';
      } else if (response.status === 403) {
        errorType = 'Forbidden - API key lacks permissions';
      } else if (response.status === 429) {
        errorType = 'Rate limit exceeded';
      } else if (response.status === 500) {
        errorType = 'Grok server error';
      }
      
      return res.status(response.status).json({
        success: false,
        error: errorType,
        status: response.status,
        statusText: response.statusText,
        details: errorText,
        apiKeyConfigured: true,
        apiKeyLength: apiKey.length
      });
    }
    
    const result = await response.json();
    console.log('✅ Grok API test successful!');
    console.log('📝 Response:', result.choices[0].message.content);
    
    // Test vision model availability
    let visionTest = null;
    try {
      const visionResponse = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'grok-vision-beta',
          messages: [
            { 
              role: 'user', 
              content: [
                { 
                  type: 'text', 
                  text: 'Vision test - please respond with "Vision working"' 
                }
              ]
            }
          ],
          max_tokens: 20,
          temperature: 0.1
        })
      });
      
      if (visionResponse.ok) {
        const visionResult = await visionResponse.json();
        visionTest = {
          success: true,
          model: visionResult.model,
          response: visionResult.choices[0].message.content
        };
      } else {
        const visionError = await visionResponse.text();
        visionTest = {
          success: false,
          status: visionResponse.status,
          error: visionError
        };
      }
    } catch (visionError) {
      visionTest = {
        success: false,
        error: visionError.message
      };
    }
    
    return res.status(200).json({
      success: true,
      message: 'Grok API key is working correctly',
      textModel: {
        model: result.model,
        response: result.choices[0].message.content,
        usage: result.usage
      },
      visionModel: visionTest,
      apiKeyConfigured: true,
      apiKeyLength: apiKey.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('💥 Test error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Network or server error',
      message: error.message,
      apiKeyConfigured: !!process.env.XAI_API_KEY,
      timestamp: new Date().toISOString()
    });
  }
}

// Vercel configuration
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
    maxDuration: 30,
  },
};