require('dotenv').config();
const { isOriginAllowedAsync, ALLOWED_CORS_HEADERS } = require('../utils/corsUtils');

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',

  jwt: {
    secret: process.env.JWT_SECRET,
    expire: process.env.JWT_EXPIRE || '7d'
  },

  cors: {
    // Await custom-domain allowlist load on cold start so merchant hosts are not
    // falsely rejected before refreshVerifiedDomainOrigins finishes.
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      isOriginAllowedAsync(origin)
        .then((allowed) => {
          if (allowed) callback(null, origin);
          else callback(new Error('Not allowed by CORS'));
        })
        .catch((err) => callback(err));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ALLOWED_CORS_HEADERS,
    preflightContinue: true,
  },
  
  pagination: {
    defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE) || 10,
    maxPageSize: parseInt(process.env.MAX_PAGE_SIZE) || 100
  }
};


