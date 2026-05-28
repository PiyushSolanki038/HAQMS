const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const doctorRoutes = require('./routes/doctors');
const appointmentRoutes = require('./routes/appointments');
const queueRoutes = require('./routes/queue');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 5000;

// FIX: Restrict CORS to known frontend origin via env variable
const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/reports', reportRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'Hospital Appointment and Queue Management System (HAQMS) Backend API',
    status: 'Running',
    version: '1.0.0',
  });
});

// Global error handler — FIX: stack trace only shown in development
app.use((err, req, res, next) => {
  console.error('[ERROR]:', err.message);
  res.status(500).json({
    message: 'An unexpected internal server error occurred.',
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// Start server only when running locally (not on Vercel serverless)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`   HAQMS BACKEND SERVER IS RUNNING ON PORT ${PORT}`);
    console.log(`   ENVIRONMENT: ${process.env.NODE_ENV}`);
    console.log(`===================================================`);
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// Required for Vercel serverless deployment
module.exports = app;
