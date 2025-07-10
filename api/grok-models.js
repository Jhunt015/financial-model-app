// Simple endpoint to list available Grok models for your API key
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (!process.env.XAI_API_KEY) {
      return res.status(500).json({
        error: 'XAI_API_KEY not configured'
      });
    }

    const apiKey = process.env.XAI_API_KEY;
    console.log('🔍 Fetching available models for team...');

    // Get available models
    const modelsResponse = await fetch('https://api.x.ai/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 Models API Status:', modelsResponse.status);

    if (!modelsResponse.ok) {
      const errorText = await modelsResponse.text();
      console.error('❌ Models API Error:', errorText);
      
      return res.status(modelsResponse.status).json({
        success: false,
        error: 'Failed to fetch models',
        status: modelsResponse.status,
        details: errorText,
        apiKeyLength: apiKey.length
      });
    }

    const modelsData = await modelsResponse.json();
    console.log('✅ Models response:', JSON.stringify(modelsData, null, 2));

    const availableModels = modelsData.data || [];
    const modelIds = availableModels.map(m => m.id);
    
    // Try a simple text completion with the first available model
    let testResult = null;
    
    if (modelIds.length > 0) {
      const testModel = modelIds[0];
      console.log(`🧪 Testing model: ${testModel}`);
      
      try {
        const testResponse = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: testModel,
            messages: [
              { 
                role: 'user', 
                content: 'Say "Hello from Grok!"'
              }
            ],
            max_tokens: 20,
            temperature: 0.1
          })
        });
        
        if (testResponse.ok) {
          const result = await testResponse.json();
          testResult = {
            success: true,
            model: testModel,
            response: result.choices[0].message.content,
            usage: result.usage
          };
          console.log('✅ Test successful:', testResult);
        } else {
          const errorText = await testResponse.text();
          testResult = {
            success: false,
            model: testModel,
            error: errorText
          };
          console.log('❌ Test failed:', testResult);
        }
      } catch (error) {
        testResult = {
          success: false,
          model: testModel,
          error: error.message
        };
      }
    }

    return res.status(200).json({
      success: true,
      message: `Found ${modelIds.length} available models`,
      availableModels: modelIds,
      modelDetails: availableModels,
      testResult,
      apiKeyConfigured: true,
      apiKeyLength: apiKey.length,
      teamId: modelsData.teamId || 'Not provided',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Network or server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
    maxDuration: 30,
  },
};