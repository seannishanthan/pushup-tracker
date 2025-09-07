const express = require('express');
const PushupSession = require('../models/PushupSession');
const requireAuth = require('../middleware/firebaseAuth');
const validateSession = require('../middleware/pushups');
const router = express.Router();

// Run Firebase auth middleware for all routes
router.use(requireAuth);

// route to create a new pushup session
router.post('/', validateSession, async (req, res) => {
    try {
        const { count, startedAt, endedAt, durationSec, notes } = req.body;
        const userId = req.user.profile._id; // Get user profile ID from Firebase auth middleware

        // Set default times if not provided
        const now = new Date();
        const sessionData = {
            user: userId,
            count,
            startedAt: startedAt ? new Date(startedAt) : now,
            endedAt: endedAt ? new Date(endedAt) : now,
            durationSec: durationSec || 0,
            notes: notes || ''
        };

        // Save session to db
        const session = new PushupSession(sessionData);
        await session.save();

        res.status(201).json({
            success: true,
            message: 'Pushup session created successfully',
            data: session
        });

    } catch (error) {
        // return 500 status code for server error
        console.error('Error creating pushup session:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create pushup session',
            error: error.message
        });
    }
});

// GET /api/pushups - List recent sessions with pagination
router.get('/', async (req, res) => {
    try {
        const userId = req.user.profile._id; // Get user profile ID from Firebase auth middleware
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit; // number of records to skip to fetch the correct page from db

        const [sessions, totalCount] = await Promise.all([
            PushupSession.find({ user: userId })
                .sort({ startedAt: -1 })
                .skip(skip)
                .limit(limit)
                .select('-__v'), // the __v field is internal version key added by mongoose, we don't need to send it to frontend
            PushupSession.countDocuments({ user: userId }) // return total number of sessions for this user
        ]);

        const totalPages = Math.ceil(totalCount / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        res.json({
            success: true,
            data: {
                sessions,
                pagination: {
                    page,
                    limit,
                    totalCount,
                    totalPages,
                    hasNext,
                    hasPrev
                }
            }
        });

    } catch (error) {
        console.error('Error fetching pushup sessions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pushup sessions',
            error: error.message
        });
    }
});

// GET /api/pushups/stats - Get user statistics
router.get('/stats', async (req, res) => {
    try {
        const userId = req.user.profile._id; // Get user profile ID from Firebase auth middleware
        const dailyGoal = parseInt(req.query.dailyGoal) || 100;

        // async static function to get user stats from model
        const stats = await PushupSession.getUserStats(userId, dailyGoal);

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Error fetching pushup stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pushup statistics',
            error: error.message
        });
    }
});

// GET /api/pushups/:id - Get specific session
router.get('/:id', async (req, res) => {
    try {
        const userId = req.user.profile._id; // Get user profile ID from Firebase auth middleware
        const sessionId = req.params.id;

        const session = await PushupSession.findOne({
            _id: sessionId,
            user: userId
        }).select('-__v');

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Pushup session not found'
            });
        }

        res.json({
            success: true,
            data: session
        });

    } catch (error) {
        console.error('Error fetching pushup session:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pushup session',
            error: error.message
        });
    }
});

// PUT /api/pushups/:id - Update specific session
router.put('/:id', validateSession, async (req, res) => {
    try {
        const userId = req.user.profile._id; // Get user profile ID from Firebase auth middleware
        const sessionId = req.params.id;
        const { count, startedAt, endedAt, notes } = req.body;

        // Build update object with only provided fields
        const updateData = {};
        if (count !== undefined) updateData.count = count;
        if (startedAt) updateData.startedAt = new Date(startedAt);
        if (endedAt) updateData.endedAt = new Date(endedAt);
        if (notes !== undefined) updateData.notes = notes;

        const session = await PushupSession.findOneAndUpdate(
            { _id: sessionId, user: userId },
            updateData,
            { new: true, runValidators: true }
        ).select('-__v');

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Pushup session not found'
            });
        }

        res.json({
            success: true,
            message: 'Pushup session updated successfully',
            data: session
        });

    } catch (error) {
        console.error('Error updating pushup session:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update pushup session',
            error: error.message
        });
    }
});

// DELETE /api/pushups/:id - Delete specific session
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.profile._id; // Get user profile ID from Firebase auth middleware
        const sessionId = req.params.id;

        const session = await PushupSession.findOneAndDelete({
            _id: sessionId,
            user: userId
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Pushup session not found'
            });
        }

        res.json({
            success: true,
            message: 'Pushup session deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting pushup session:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete pushup session',
            error: error.message
        });
    }
});

module.exports = router;
