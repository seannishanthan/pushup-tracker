require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/database');

const authRoutes = require('./routes/auth');
const pushupRoutes = require('./routes/pushups');

const app = express();

// Middleware
// app.use(cors(
//     {
//         origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : 'http://localhost:5173',
//         credentials: true // Allow credentials for cookies
//     }
// ));

// Added for deployment for Render
const allowlist = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
  ...(process.env.EXTRA_ORIGINS || '').split(',').filter(Boolean),
].filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // curl/health checks
    const allowed =
      allowlist.includes(origin) ||
      /\.vercel\.app$/.test(origin) ||
      /\.onrender\.com$/.test(origin);   // allow Render static sites
    cb(null, allowed);
  },
  credentials: true,                     // ok even if you don't use cookies
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.options('*', cors());



app.use(express.json({limit: '10mb'})); // before hitting any route, we want to parse the request body as JSON
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // let server parse URL-encoded data like form data


// if we are in development mode, we want to log the requests to the console for debugging
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
  });
}

app.use('/api/auth', authRoutes);
app.use('/api/pushups', pushupRoutes);


// Test route
// whenever user makes a GET request to /api/test, it will return a JSON response
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Push-up Tracker API is running!',
    timestamp: new Date().toISOString()
  });
});

// If a request comes in for a route that does not exist, return 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!'
  });
});


const PORT = process.env.PORT || 5000;

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', err);
  process.exit(1);
});