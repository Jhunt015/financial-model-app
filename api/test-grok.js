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
    console.log('🔑 API Key starts with xai-:', apiKey.startsWith('xai-'));
    
    // First, let's try to get available models
    console.log('🔍 Checking available models...');
    let availableModels = [];
    try {
      const modelsResponse = await fetch('https://api.x.ai/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (modelsResponse.ok) {
        const modelsData = await modelsResponse.json();
        availableModels = modelsData.data?.map(m => m.id) || [];
        console.log('✅ Available models:', availableModels);
      } else {
        console.log('⚠️ Could not fetch models:', modelsResponse.status);
      }
    } catch (e) {
      console.log('⚠️ Models endpoint error:', e.message);
    }

    // Try different model names
    const modelsToTry = [
      'grok-vision-beta',
      'grok-beta', 
      'grok-1',
      'grok',
      ...availableModels
    ];
    
    let successfulModel = null;
    let lastError = null;
    
    for (const modelName of modelsToTry) {
      console.log(`🧪 Testing model: ${modelName}`);
      
      try {
        const testResponse = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { 
                role: 'user', 
                content: modelName.includes('vision') ? [
                  {
                    type: 'text',
                    text: 'Hello! Please respond with "API test successful" if you can see this message.'
                  }
                ] : 'Hello! Please respond with "API test successful" if you can see this message.'
              }
            ],
            max_tokens: 50,
            temperature: 0.1
          })
        });
        
        if (testResponse.ok) {
          const result = await testResponse.json();
          console.log(`✅ Success with model: ${modelName}`);
          successfulModel = {
            model: modelName,
            response: result.choices[0].message.content,
            usage: result.usage
          };
          break;
        } else {
          const errorText = await testResponse.text();
          console.log(`❌ Failed with model ${modelName}:`, testResponse.status, errorText);
          lastError = { model: modelName, status: testResponse.status, error: errorText };
        }
      } catch (error) {
        console.log(`💥 Exception with model ${modelName}:`, error.message);
        lastError = { model: modelName, error: error.message };
      }
    }
    
    if (!successfulModel) {
      return res.status(500).json({
        success: false,
        error: 'No working model found',
        availableModels,
        modelsTestedCount: modelsToTry.length,
        lastError,
        apiKeyConfigured: true,
        apiKeyLength: apiKey.length
      });
    }
    
    console.log('✅ Grok API test successful!');
    console.log('📝 Response:', result.response);
    
    // Test vision capabilities if we found a vision model
    let imageVisionTest = { success: false, reason: 'No vision model found' };
    
    if (result.model.includes('vision')) {
      console.log('🖼️ Testing vision capabilities...');
      imageVisionTest = { success: true, reason: 'Vision model available', model: result.model };
    }
    
    return res.status(200).json({
      success: true,
      message: `Grok API is working correctly with model: ${result.model}`,
      workingModel: result,
      availableModels,
      imageVisionTest: imageVisionTest,
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