// Simple AWS credentials check
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const config = {
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyPreview: process.env.AWS_ACCESS_KEY_ID ? 
        process.env.AWS_ACCESS_KEY_ID.substring(0, 8) + '...' : 'Not set',
      timestamp: new Date().toISOString()
    };

    return res.status(200).json({
      configured: config.hasAccessKey && config.hasSecretKey,
      config: config,
      instructions: !config.hasAccessKey || !config.hasSecretKey ? 
        'Add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to Vercel environment variables' :
        'AWS credentials appear to be configured'
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
}