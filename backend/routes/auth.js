const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authenticateToken = require('../middleware/auth');
const router = express.Router();

// An auth route is part of backend that handles user login/registration
// url paths that frontend talks to when user wants to login/register/get their profile

// Function to generate JWT token
const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: '1h' } // Token expires in 1 hour
    );
}


// this route will be called when user wants to register
// it will create/POST a new user in the database and return a JWT token
router.post('/register', async (req, res) => {
    try {
        // Read user data from request body
        const { username, email, password } = req.body;

        // Check if all required fields are provided, if not return 400 which means bad request
        if (!username || !email || !password) {
            return res.status(400).json({
                message: 'Please provide all required fields: username, email, password',
                success: false
            });
        }

        // Check if user already exists by looking for database entry with same email or username and return the user entry if it exists
        const existingUser = await User.findOne({
            $or: [{ email: email.toLowerCase() }, { username }]
        })

        // if user already exists, return 400 which means bad request
        if (existingUser) {
            return res.status(400).json({
                message: existingUser.email === email.toLowerCase() ? 'Email already exists' : 'Username already exists',
                success: false
            });
        }

        // Create new user if it does not exist yet
        const user = new User({
            username,
            email: email.toLowerCase(),
            password
        });

        // await because we want to wait for the user to be saved to the database before proceeding to generate the token
        await user.save(); // Save user to database

        const token = generateToken(user._id);

        // Return success response with token only
        res.status(201).json({
            success: true,
            message: 'Account created successfully!',
            token
        });


    } catch (error) {
        console.error('Registration error:', error);

        // Handle invalid email format
        if (error.name === 'ValidationError') {

            // Return an array of error messages for each field that failed validation
            const errors = Object.values(error.errors).map(err => err.message);

            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors
            });
        }

        res.status(500).json({
            message: 'Server error during registration',
            success: false
        });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if email and password are provided
        if (!email || !password) {
            return res.status(400).json({
                message: 'Please provide both email and password',
                success: false
            });
        }

        // Find user in database by email
        const user = await User.findOne({ email: email.toLowerCase() });

        // If user not found, return 401 which means unauthorized
        if (!user) {
            return res.status(401).json({
                message: 'Invalid email or password',
                success: false
            });
        }

        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            return res.status(401).json({
                message: 'Invalid email or password',
                success: false
            });
        }

        const token = generateToken(user._id);

        // Return token only
        res.status(200).json({
            success: true,
            message: 'Login successful',
            token
        });

    } catch (error) {
        console.error('Login error:', error);

        // Return 500 which means internal server error
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
});

// Route to handle fetching user profile, authenticateToken is middleware that checks if user is authenticated before we return the profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            user: req.user // Get public profile (password excluded for security)
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
router.put('/profile/goal', authenticateToken, async (req, res) => {
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
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
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

module.exports = router;