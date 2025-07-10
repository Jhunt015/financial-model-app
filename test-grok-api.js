// Quick test script to verify Grok API key functionality
// This will test the API without going through the full application

async function testGrokAPI() {
  console.log('🔍 Testing Grok API connection...');
  
  // You'll need to set your API key here for local testing
  const API_KEY = process.env.XAI_API_KEY || 'xai-YOUR_KEY_HERE';
  
  if (!API_KEY || API_KEY === 'xai-YOUR_KEY_HERE') {
    console.error('❌ Please set XAI_API_KEY environment variable or update the script with your key');
    return;
  }
  
  try {
    // Simple text-only test first (no vision)
    console.log('📝 Testing basic text completion...');
    
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-beta', // Use text model first
        messages: [
          { 
            role: 'user', 
            content: 'Hello! Please respond with "Grok API is working correctly" if you can see this message.' 
          }
        ],
        max_tokens: 50,
        temperature: 0.1
      })
    });
    
    console.log('📊 Response Status:', response.status, response.statusText);
    console.log('📋 Response Headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:', errorText);
      
      if (response.status === 401) {
        console.error('🔑 Authentication failed - API key may be invalid or revoked');
      } else if (response.status === 403) {
        console.error('🚫 Forbidden - API key may not have proper permissions');
      } else if (response.status === 429) {
        console.error('⏰ Rate limit exceeded - too many requests');
      } else if (response.status === 500) {
        console.error('🔧 Server error - Grok API may be experiencing issues');
      }
      
      return;
    }
    
    const result = await response.json();
    console.log('✅ Basic API Test Successful!');
    console.log('📝 Response:', result.choices[0].message.content);
    console.log('🎯 Model Used:', result.model);
    console.log('💰 Token Usage:', result.usage);
    
    // Now test vision model
    console.log('\n🔍 Testing vision model availability...');
    
    const visionResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-vision-beta',
        messages: [
          { 
            role: 'user', 
            content: [
              { 
                type: 'text', 
                text: 'Can you see images? Please respond with "Vision model working" if this request is processed correctly.' 
              }
            ]
          }
        ],
        max_tokens: 50,
        temperature: 0.1
      })
    });
    
    console.log('👁️ Vision Model Status:', visionResponse.status, visionResponse.statusText);
    
    if (!visionResponse.ok) {
      const visionErrorText = await visionResponse.text();
      console.error('❌ Vision Model Error:', visionErrorText);
      
      if (visionResponse.status === 400) {
        console.error('📝 Bad request - Vision model may require different format');
      } else if (visionResponse.status === 404) {
        console.error('🔍 Vision model not found - may not be available yet');
      }
    } else {
      const visionResult = await visionResponse.json();
      console.log('✅ Vision Model Test Successful!');
      console.log('👁️ Vision Response:', visionResult.choices[0].message.content);
      console.log('🎯 Vision Model:', visionResult.model);
    }
    
  } catch (error) {
    console.error('💥 Network or parsing error:', error.message);
    console.error('🔍 Full error:', error);
  }
}

// Run the test
testGrokAPI();