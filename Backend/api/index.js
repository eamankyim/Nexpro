// Vercel serverless function entry point
// Explicitly require pg and pg-hstore to ensure they're included in the bundle
// This is necessary for Vercel serverless functions to include native dependencies
require('pg');
require('pg-hstore');

// Now require the server
const app = require('../server');

module.exports = app;

