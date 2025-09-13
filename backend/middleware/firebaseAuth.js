const { admin } = require('../config/firebaseAdmin');
const User = require('../models/User');

async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization || '';
        const match = authHeader.match(/^Bearer (.+)$/);

        if (!match) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const idToken = match[1];

        // Decode the Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        console.log(`🔍 Token verification for user: ${decodedToken.email}, UID: ${decodedToken.uid}, Email verified: ${decodedToken.email_verified}`);
        console.log(`🔍 Token issued at: ${new Date(decodedToken.iat * 1000).toISOString()}`);
        console.log(`🔍 Token expires at: ${new Date(decodedToken.exp * 1000).toISOString()}`);

        // Enforce email verification server-side
        if (!decodedToken.email_verified) {
            console.log(`❌ Email not verified for user: ${decodedToken.email}`);
            console.log(`❌ Token was issued at: ${new Date(decodedToken.iat * 1000).toISOString()}`);
            return res.status(403).json({
                success: false,
                message: 'Please verify your email'
            });
        }

        // Check if user profile exists
        let user = await User.findOne({ uid: decodedToken.uid });

        // Attach user info to request
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            claims: decodedToken,
            profile: user // This will be null if no profile exists yet
        };

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
}

module.exports = requireAuth;
