const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to authenticate user based on JWT token
const authenticateToken = async (req, res, next) => {
    try{

        // get token from req header, frontend will send Authorization: Bearer token
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // split 'Bearer token' to get token

        // if token is null or undefined, return 401 which means unauthorized
        if (!token) {
            return res.status(401).json({ 
                message: 'Access denied, no token provided',
                success: false
            });
        }

        // verify jwt token with our secret key that user sent to server through a request header
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // fetch user from database using decoded user id
        const user = await User.findById(decoded.userId).select('-password'); // exclude password field

        if (!user) {
            return res.status(401).json({
                message: 'Invalid token, user not found',
                success: false
            });
        }

        // add user info to req object so that it can be accessed in the next middleware or route handler
        req.user = user;
        next();

    } catch (error) {

        // if the token is invalid, return 401
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                message: 'Invalid token format',
                success: false
            });
        }

        // if the token is expired, return 401
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                message: 'Token has expired',
                success: false
            });
        }

        console.error('Authentication middlware error:', error);
        res.status(500).json({
            message: 'Internal server error during authentication',
            success: false
        });
    }
};

module.exports = authenticateToken;