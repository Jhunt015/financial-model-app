// Simple Textract test with minimal PDF
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // Check credentials first
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return res.status(400).json({
        error: 'AWS credentials not configured',
        details: {
          hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
          hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
          region: process.env.AWS_REGION || 'not-set'
        }
      });
    }

    // Try AWS SDK v3 import
    const { TextractClient, DetectDocumentTextCommand } = await import('@aws-sdk/client-textract');
    
    // Create client
    const client = new TextractClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    // Create a minimal PDF with some text
    const testPdf = Buffer.from('JVBERi0xLjQNCiXi48+TBQo' +
      'MQXCB7OvKEBQgCkF4hONfOuLxBXwBCAcAUEOeCAAQCAAMAg' +
      'WPT5Bg4AjgNE0ASiWPR1dKCAl0JgpfHE5EQAAA4ATPX2IrKZWy' +
      'DnJnKAjPUY5W6KjBBo0bBZnU2EJLCJE1BKI0xSgI', 'base64');

    // Test Textract
    const command = new DetectDocumentTextCommand({
      Document: {
        Bytes: testPdf
      }
    });

    const result = await client.send(command);
    
    return res.status(200).json({
      success: true,
      message: 'AWS Textract is working!',
      blocksFound: result.Blocks?.length || 0,
      textDetected: result.Blocks?.filter(b => b.BlockType === 'WORD')?.length || 0,
      credentials: {
        accessKeyPrefix: process.env.AWS_ACCESS_KEY_ID.substring(0, 6) + '...',
        region: process.env.AWS_REGION || 'us-east-1'
      }
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Textract test failed',
      message: error.message,
      errorType: error.constructor.name,
      awsError: error.Code || 'Unknown',
      credentials: {
        hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'not-set'
      }
    });
  }
}