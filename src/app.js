import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';

import env from './config/env.js';
import errorHandler from './middlewares/error.middleware.js';
import authRoutes from './routes/auth.routes.js';
import kycRoutes from './routes/kyc.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import userRoutes from './routes/user.routes.js';
import stockRoutes from './routes/stock.routes.js';
import subscriptionRoutes from './routes/subscription.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import paymentWebhook from './webhooks/payment.webhook.js';
import kycWebhook from './webhooks/kyc.webhook.js';

const app = express();

// JSON parser with raw body capture for webhooks only (to verify signatures)
app.use(
  express.json({
    verify: (req, _res, buf) => {
      if (req.originalUrl && req.originalUrl.startsWith('/webhooks')) {
        req.rawBody = buf.toString('utf8');
      }
    },
  })
);

// Security & basics
app.use(helmet());
app.use(cors());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.urlencoded({ extended: true }));

// Auth header logger (for testing): logs method, path and Authorization header
// WARNING: In production, do NOT log full tokens
app.use((req, _res, next) => {
  const auth = req.headers['authorization'] || '';
  const isProd = env.NODE_ENV === 'production';
  const toLog = isProd ? (auth ? `${auth.slice(0, 16)}...` : '<none>') : (auth || '<none>');
  if (req.originalUrl !== '/health') {
    console.log('🔐 AuthHeader', { method: req.method, path: req.originalUrl, authorization: toLog });
  }
  next();
});

// Swagger setup
const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'Fintech Backend API', version: '0.1.0' },
    servers: [{ url: `http://localhost:${env.PORT}` }],
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
  apis: ['./src/routes/*.js'],
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health
app.get('/health', (_req, res) => res.json({ success: true, message: 'OK', env: env.NODE_ENV }));

// Routes
app.use('/auth', authRoutes);
app.use('/kyc', kycRoutes);
app.use('/payment', paymentRoutes);
app.use('/user', userRoutes);
app.use('/stocks', stockRoutes);
app.use('/subscription', subscriptionRoutes);
app.use('/api/notifications', notificationRoutes);

// Webhooks
app.use('/webhooks', paymentWebhook);
app.use('/webhooks', kycWebhook);

// 404
app.use((req, res) => res.status(404).json({ success: false, message: 'Not Found' }));

// Error handler
app.use(errorHandler);

export default app;
