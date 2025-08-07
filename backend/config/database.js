// module file to configure and connect to MongoDB database using mongoose

const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const connection = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`✅ MongoDB connected: ${connection.connection.host}`);
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1); //exit process with failure
    }
};

module.exports = connectDB;
