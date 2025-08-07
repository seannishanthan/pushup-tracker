require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');

const app = express();

// Middleware
app.use(cors(
    {
        origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : 'http://localhost:5173',
        credentials: true // Allow credentials for cookies
    }
));


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

// Test route
// whenever user makes a GET request to /api/test, it will return a JSON response
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!' });
});

// Health check route
app.get('/api/health', (req, res) => {
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

// Connect to MongoDB and start the server
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas!');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', err);
  process.exit(1);
});