const express = require('express');
const User = require('../models/User');
const requireAuth = require('../middleware/firebaseAuth');
const { admin } = require('../config/firebaseAdmin');
const router = express.Router();

// Create user profile during registration (before email verification)
router.post('/register-profile', async (req, res) => {
    try {
        console.log('🔄 Registration profile creation request');
        console.log('📱 User agent:', req.headers['user-agent']);
        console.log('🌐 Origin:', req.headers.origin);
        console.log('📋 Request headers:', JSON.stringify(req.headers, null, 2));

        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            console.log('❌ No authorization header found');
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const idToken = authHeader.split('Bearer ')[1];
        console.log('🔑 Token length:', idToken.length);

        const decodedToken = await admin.auth().verifyIdToken(idToken);

        console.log('👤 Creating profile for user:', decodedToken.uid, 'Email:', decodedToken.email);
        console.log('👤 Request body:', req.body);
        console.log('👤 Token decoded successfully, email verified:', decodedToken.email_verified);

        const { name } = req.body;

        // Format name: capitalize first letter, lowercase rest
        const formattedName = name ? name.charAt(0).toUpperCase() + name.slice(1).toLowerCase() : null;

        // Check if user profile already exists
        console.log('🔍 Checking for existing user profile...');
        const existingUser = await User.findOne({ uid: decodedToken.uid });
        if (existingUser) {
            console.log('❌ Profile already exists for user:', decodedToken.uid);
            return res.status(400).json({
                message: 'User profile already exists',
                success: false
            });
        }

        // Create new user profile (without email verification requirement)
        console.log('🔄 Creating new user profile...');
        const newUser = new User({
            uid: decodedToken.uid,
            name: formattedName || decodedToken.email.split('@')[0],
            email: decodedToken.email,
            dailyGoal: 50
        });

        console.log('💾 Saving user to database...');
        await newUser.save();
        console.log('✅ Registration profile created successfully for user:', decodedToken.uid, 'with name:', newUser.name);
        console.log('📋 Full user profile:', newUser.toObject());
        console.log('📋 User ID:', newUser._id);

        res.status(201).json({
            success: true,
            user: newUser.getPublicProfile(),
            message: 'User profile created successfully during registration'
        });
    } catch (error) {
        console.error('❌ Registration profile creation error:', error);
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);

        // Check if it's a MongoDB connection error
        if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
            console.error('❌ MongoDB connection error detected');
            res.status(503).json({
                message: 'Database connection error. Please try again.',
                success: false
            });
        } else if (error.name === 'ValidationError') {
            console.error('❌ Validation error detected');
            res.status(400).json({
                message: 'Invalid user data provided',
                success: false
            });
        } else {
            res.status(500).json({
                message: 'Server error while creating user profile during registration',
                success: false
            });
        }
    }
});

// Create user profile after Firebase registration
router.post('/profile', requireAuth, async (req, res) => {
    try {
        console.log('👤 Profile creation request for user:', req.user.uid);
        console.log('👤 Request body:', req.body);

        const { name, email } = req.body;

        // Format name: capitalize first letter, lowercase rest
        const formattedName = name ? name.charAt(0).toUpperCase() + name.slice(1).toLowerCase() : null;

        // Check if user profile already exists
        const existingUser = await User.findOne({ uid: req.user.uid });
        if (existingUser) {
            console.log('❌ Profile already exists for user:', req.user.uid);
            return res.status(400).json({
                message: 'User profile already exists',
                success: false
            });
        }

        // Create new user profile
        const newUser = new User({
            uid: req.user.uid,
            name: formattedName || req.user.email.split('@')[0], // Default name from email
            email: req.user.email,
            dailyGoal: 50 // Default daily goal
        });

        await newUser.save();
        console.log('✅ Profile created successfully for user:', req.user.uid, 'with name:', newUser.name);

        res.status(201).json({
            success: true,
            user: newUser.getPublicProfile(),
            message: 'User profile created successfully'
        });
    } catch (error) {
        console.error('User creation error:', error);
        res.status(500).json({
            message: 'Server error while creating user profile',
            success: false
        });
    }
});

// Profile endpoint - get user profile with stats (auto-create if doesn't exist)
router.get('/profile', requireAuth, async (req, res) => {
    try {
        console.log('📋 Profile request for user:', req.user.uid);
        console.log('📋 User profile found:', !!req.user.profile);

        let userProfile = req.user.profile;

        // If user profile doesn't exist, auto-create it for verified users
        if (!userProfile) {
            console.log('🔄 Auto-creating profile for verified user:', req.user.uid);

            // Try to find if there's an existing profile that might not have been loaded
            const existingProfile = await User.findOne({ uid: req.user.uid });

            if (existingProfile) {
                console.log('✅ Found existing profile for user:', req.user.uid, 'with name:', existingProfile.name);
                userProfile = existingProfile;
            } else {
                // Create new profile with default name from email
                userProfile = new User({
                    uid: req.user.uid,
                    name: req.user.email.split('@')[0], // Default name from email
                    email: req.user.email,
                    dailyGoal: 50 // Default daily goal
                });

                await userProfile.save();
                console.log('✅ Auto-created profile for user:', req.user.uid, 'with name:', userProfile.name);
            }
        }

        res.json({
            success: true,
            user: userProfile.getPublicProfile()
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({
            message: 'Server error while fetching user profile',
            success: false
        });
    }
});

// Route to update user's daily goal
router.put('/profile/goal', requireAuth, async (req, res) => {
    try {
        const { dailyGoal } = req.body;

        // Validate the daily goal
        if (!dailyGoal || isNaN(dailyGoal) || parseInt(dailyGoal) <= 0) {
            return res.status(400).json({
                message: 'Please provide a valid daily goal (positive number)',
                success: false
            });
        }

        // Update the user's daily goal
        const updatedUser = await User.findOneAndUpdate(
            { uid: req.user.uid },
            { dailyGoal: parseInt(dailyGoal) },
            { new: true } // Return the updated user
        );

        if (!updatedUser) {
            return res.status(404).json({
                message: 'User not found',
                success: false
            });
        }

        res.json({
            success: true,
            message: 'Daily goal updated successfully',
            user: updatedUser.getPublicProfile()
        });

    } catch (error) {
        console.error('Goal update error:', error);
        res.status(500).json({
            message: 'Server error while updating daily goal',
            success: false
        });
    }
});

// Route to update user's name
router.put('/profile/name', requireAuth, async (req, res) => {
    try {
        const { name } = req.body;

        // Validate the name
        if (!name || name.trim().length < 2) {
            return res.status(400).json({
                message: 'Name must be at least 2 characters long',
                success: false
            });
        }

        // Check for spaces in name
        if (/\s/.test(name.trim())) {
            return res.status(400).json({
                message: 'Name cannot contain spaces',
                success: false
            });
        }

        // Format name: capitalize first letter, lowercase rest
        const formattedName = name.trim().charAt(0).toUpperCase() + name.trim().slice(1).toLowerCase();

        // Update the user's name
        const updatedUser = await User.findOneAndUpdate(
            { uid: req.user.uid },
            { name: formattedName },
            { new: true } // Return the updated user
        );

        if (!updatedUser) {
            return res.status(404).json({
                message: 'User not found',
                success: false
            });
        }

        res.json({
            success: true,
            user: updatedUser.getPublicProfile(),
            message: 'Name updated successfully'
        });
    } catch (error) {
        console.error('Update name error:', error);
        res.status(500).json({
            message: 'Server error while updating name',
            success: false
        });
    }
});

// Health check endpoint for authentication
router.get('/check', requireAuth, (req, res) => {
    res.json({
        success: true,
        message: 'Authentication valid',
        uid: req.user.uid
    });
});

// Debug endpoint to check user profile data
router.get('/debug-profile', requireAuth, async (req, res) => {
    try {
        console.log('🔍 Debug profile request for user:', req.user.uid);

        // Check if profile exists in req.user
        console.log('🔍 Profile from middleware:', req.user.profile);

        // Try to find profile directly
        const directProfile = await User.findOne({ uid: req.user.uid });
        console.log('🔍 Direct profile lookup:', directProfile);

        res.json({
            success: true,
            middlewareProfile: req.user.profile,
            directProfile: directProfile,
            userClaims: req.user.claims
        });
    } catch (error) {
        console.error('Debug profile error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;