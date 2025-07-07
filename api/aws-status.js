// Simple AWS status check
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const status = {
    timestamp: new Date().toISOString(),
    environment: 'production',
    aws: {
      accessKeyConfigured: !!process.env.AWS_ACCESS_KEY_ID,
      secretKeyConfigured: !!process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'not-set',
      accessKeyPreview: process.env.AWS_ACCESS_KEY_ID ? 
        process.env.AWS_ACCESS_KEY_ID.substring(0, 6) + '...' : 'MISSING'
    },
    openai: {
      configured: !!process.env.OPENAI_API_KEY,
      keyPreview: process.env.OPENAI_API_KEY ? 
        process.env.OPENAI_API_KEY.substring(0, 6) + '...' : 'MISSING'
    }
  };

  return res.status(200).json(status);
}