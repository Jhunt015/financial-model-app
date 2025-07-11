// Test your Claude API key
const testClaudeAPI = async () => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-opus-20240229',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: 'Hello, Claude! Please respond with "API key is working!"'
        }
      ]
    })
  });

  const data = await response.json();
  console.log('Response:', data);
  
  if (response.ok) {
    console.log('✅ API key is working!');
  } else {
    console.error('❌ API key error:', data);
  }
};

testClaudeAPI();