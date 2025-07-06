export default async function handler(req, res) {
  try {
    console.log('=== TEST API CALLED ===');
    console.log('Method:', req.method);
    console.log('Environment variables available:', {
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      nodeEnv: process.env.NODE_ENV
    });
    
    res.json({
      success: true,
      message: 'Test API is working',
      timestamp: new Date().toISOString(),
      environment: {
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        nodeEnv: process.env.NODE_ENV
      }
    });
  } catch (error) {
    console.error('Test API error:', error);
    res.status(500).json({
      error: 'Test API failed',
      message: error.message
    });
  }
}