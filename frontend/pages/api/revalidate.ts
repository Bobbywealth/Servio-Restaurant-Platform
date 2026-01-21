// ISR REVALIDATION API ENDPOINT
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check for secret to confirm this is a valid request
  const revalidationToken = process.env.REVALIDATION_TOKEN || 'dev-secret';
  
  if (!req.headers.authorization || req.headers.authorization !== `Bearer ${revalidationToken}`) {
    return res.status(401).json({ 
      message: 'Invalid token',
      revalidated: false 
    });
  }

  try {
    const path = req.query.path as string;
    
    if (!path) {
      return res.status(400).json({ 
        message: 'Path parameter is required',
        revalidated: false 
      });
    }

    // This will revalidate the specific path
    await res.revalidate(path);
    
    console.log(`✅ Successfully revalidated: ${path}`);
    
    return res.json({ 
      revalidated: true, 
      path,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Error revalidating:', err);
    
    return res.status(500).json({ 
      message: 'Error revalidating',
      error: err instanceof Error ? err.message : 'Unknown error',
      revalidated: false 
    });
  }
}