require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  jwt: {
    secret: process.env.JWT_SECRET,
    expire: process.env.JWT_EXPIRE || '7d'
  },
  
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Normalize origin (remove trailing slash)
      const normalizedOrigin = origin.replace(/\/$/, '');
      
      const allowedOrigins = process.env.CORS_ORIGIN 
        ? process.env.CORS_ORIGIN.split(',').map(orig => orig.trim().replace(/\/$/, ''))
        : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:4321'];
      
      // Allow all Vercel preview and production URLs
      const isVercelUrl = normalizedOrigin.includes('.vercel.app') || normalizedOrigin.includes('vercel.app');
      
      // Check if origin is in allowed list or is a Vercel URL
      if (allowedOrigins.includes(normalizedOrigin) || isVercelUrl) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  },
  
  pagination: {
    defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE) || 10,
    maxPageSize: parseInt(process.env.MAX_PAGE_SIZE) || 100
  }
};


