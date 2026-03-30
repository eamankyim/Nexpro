const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'ABS (African Business Suite) API',
      version: '1.0.0',
      description:
        'REST API documentation for the African Business Suite platform. All endpoints (except auth/signup) require a Bearer token.',
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Local development server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  apis: [
    './routes/*.js',
    './controllers/*.js',
  ],
};

const openapiSpecification = swaggerJsdoc(options);

module.exports = openapiSpecification;


