const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { sequelize, testConnection } = require('./config/database');
const config = require('./config/config');
const errorHandler = require('./middleware/errorHandler');

// Import models to ensure relationships are set up
require('./models');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const customerRoutes = require('./routes/customerRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const jobRoutes = require('./routes/jobRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const pricingRoutes = require('./routes/pricingRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();

// Middleware
app.use(helmet());
app.use(cors(config.cors));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    environment: config.nodeEnv
  });
});

// Root route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Printing Press Management API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      customers: '/api/customers',
      vendors: '/api/vendors',
      jobs: '/api/jobs',
      payments: '/api/payments',
      expenses: '/api/expenses',
      pricing: '/api/pricing',
      invoices: '/api/invoices',
      dashboard: '/api/dashboard'
    }
  });
});

// Error handler (must be last)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Database connection and server start
const PORT = config.port;

const startServer = async () => {
  try {
    await testConnection();
    
    // Sync database (in production, use migrations instead)
    if (config.nodeEnv === 'development') {
      await sequelize.sync({ alter: true });
      console.log('📊 Database synchronized');
    }
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running in ${config.nodeEnv} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;

