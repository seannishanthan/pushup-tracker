// module file to configure and connect to MongoDB database using mongoose

const mongoose = require('mongoose');

// Optimize mongoose connection settings for serverless/cold start scenarios
mongoose.set('bufferCommands', false); // Disable mongoose buffering

const connectDB = async () => {
    try {
        // Check if already connected
        if (mongoose.connection.readyState === 1) {
            console.log('✅ MongoDB already connected');
            return;
        }

        const connection = await mongoose.connect(process.env.MONGODB_URI, {
            // Optimize for serverless/cold start scenarios
            maxPoolSize: 10, // Maintain up to 10 socket connections
            serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
            socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
            bufferCommands: false, // Disable mongoose buffering
            // Connection pool settings
            maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
            minPoolSize: 2, // Maintain at least 2 socket connections
        });

        console.log(`✅ MongoDB connected: ${connection.connection.host}`);

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('⚠️ MongoDB disconnected');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('✅ MongoDB reconnected');
        });

    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1); //exit process with failure
    }
};

module.exports = connectDB;
