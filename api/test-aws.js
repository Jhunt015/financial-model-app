// Test AWS credentials configuration
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const awsConfig = {
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyPrefix: process.env.AWS_ACCESS_KEY_ID ? 
        process.env.AWS_ACCESS_KEY_ID.substring(0, 4) + '...' : 'Not set'
    };

    return res.status(200).json({
      success: true,
      awsConfigured: awsConfig.hasAccessKey && awsConfig.hasSecretKey,
      config: awsConfig,
      message: awsConfig.hasAccessKey && awsConfig.hasSecretKey ? 
        'AWS credentials are configured' : 
        'AWS credentials missing - will fallback to AI-only analysis'
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Configuration check failed',
      message: error.message
    });
  }
}