// Test Claude API key functionality
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('🔍 Testing Claude API from Vercel environment...');
    
    // Check if API key is available
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'ANTHROPIC_API_KEY environment variable not found',
        message: 'API key not configured in Vercel environment variables'
      });
    }
    
    const apiKey = process.env.ANTHROPIC_API_KEY;
    console.log('🔑 API Key found, length:', apiKey.length);
    console.log('🔑 API Key prefix:', apiKey.substring(0, 10) + '...');
    console.log('🔑 API Key starts with sk-ant-:', apiKey.startsWith('sk-ant-'));
    
    // Test basic Claude API call
    console.log('🧪 Testing basic Claude API call...');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: 'Hello! Please respond with "Claude API test successful" if you can see this message.'
          }
        ]
      })
    });
    
    console.log('📊 Claude API Status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Claude API Error:', errorText);
      
      return res.status(response.status).json({
        success: false,
        error: 'Claude API request failed',
        status: response.status,
        statusText: response.statusText,
        details: errorText,
        apiKeyConfigured: true,
        apiKeyLength: apiKey.length
      });
    }
    
    const result = await response.json();
    console.log('✅ Claude API test successful!');
    console.log('📝 Response:', result.content[0].text);
    
    return res.status(200).json({
      success: true,
      message: 'Claude API is working correctly',
      response: result.content[0].text,
      model: result.model,
      usage: result.usage,
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
      apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY,
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