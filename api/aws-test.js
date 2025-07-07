// Simple AWS Textract connection test
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // Import AWS SDK v2 (same as main endpoint)
    const AWS = await import('aws-sdk');
    
    // Configure AWS
    const awsConfig = {
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    };

    AWS.default.config.update(awsConfig);
    const textract = new AWS.default.Textract(awsConfig);

    // Test AWS connection with a simple call
    const params = {
      Document: {
        Bytes: Buffer.from('JVBERi0xLjQKJeHg8+j/CjEgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDIgMCBSCj4+CmVuZG9iagoKMiAwIG9iago8PAovVHlwZSAvUGFnZXMKL0tpZHMgWzMgMCBSXQovQ291bnQgMQo+PgplbmRvYmoKCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCgo0IDAgb2JqCjw8Ci9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCi9GMSAxMiBUZgo3MiA3MjAgVGQKKEhlbGxvIFdvcmxkKSBUagpFVApzdHJlYW0KZW5kb2JqCgo1IDAgb2JqCjw8Ci9UeXBlIC9Gb250Ci9TdWJ0eXBlIC9UeXBlMQovQmFzZUZvbnQgL0hlbHZldGljYQo+PgplbmRvYmoKCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZgowMDAwMDAwMDA5IDAwMDAwIG4KMDAwMDAwMDA1OCAwMDAwMCBuCjAwMDAwMDAxMTUgMDAwMDAgbgowMDAwMDAwMjA1IDAwMDAwIG4KMDAwMDAwMDI5OSAwMDAwMCBuCnRyYWlsZXIKPDwKL1NpemUgNgovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKMzk2CiUlRU9G', 'base64')
      }
    };

    // Try to detect document text
    const result = await textract.detectDocumentText(params).promise();
    
    return res.status(200).json({
      success: true,
      message: 'AWS Textract is working!',
      credentials: {
        accessKeyPrefix: process.env.AWS_ACCESS_KEY_ID?.substring(0, 6) + '...',
        region: process.env.AWS_REGION || 'us-east-1',
        configured: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
      },
      testResult: {
        blocksFound: result.Blocks?.length || 0,
        textDetected: result.Blocks?.filter(b => b.BlockType === 'WORD')?.length || 0
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      errorCode: error.code,
      credentials: {
        hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'not-set'
      }
    });
  }
}