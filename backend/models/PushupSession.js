const mongoose = require('mongoose');

const pushupSessionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true // For efficient queries by user
    },
    count: {
        type: Number,
        required: true,
        min: [0, 'Count must be non-negative'],
        validate: {
            validator: Number.isInteger,
            message: 'Count must be a whole number'
        }
    },
    startedAt: { // When user starts session
        type: Date,
        required: true,
        default: Date.now
    },
    endedAt: { // When user ends session
        type: Date,
        required: true,
        validate: {
            validator: function (endTime) {
                return endTime >= this.startedAt;
            },
            message: 'End time must be after start time'
        }
    },
    durationSec: {
        type: Number,
        min: [0, 'Duration must be non-negative'],
        default: 0
    },
    notes: {
        type: String,
        maxlength: [500, 'Notes cannot exceed 500 characters'],
        trim: true,
        default: ''
    }
}, {
    timestamps: true, // Adds createdAt and updatedAt (timestamps for saving to database and when record was last modified in database)
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Index for efficient queries 
pushupSessionSchema.index({ user: 1, startedAt: -1 }); //sort records by ascending user id and descending startedAt date

// Pre-save middleware to compute duration from start and end times
pushupSessionSchema.pre('save', function (next) {
    // Ensure we have both start and end times
    if (!this.endedAt && this.startedAt) {
        this.endedAt = this.startedAt; // If no end time, assume it's the same as start time
    }

    if (this.startedAt && this.endedAt) {
        this.durationSec = Math.round((this.endedAt - this.startedAt) / 1000);
    }
    next();
});

// Virtual fields for formatted duration (format = minutes and seconds, calculated on the fly)
pushupSessionSchema.virtual('durationFormatted').get(function () {
    const minutes = Math.floor(this.durationSec / 60);
    const seconds = this.durationSec % 60;
    return `${minutes}m ${seconds}s`;
});

// Static methods for stats calculations (accesses all sessions for a user)
pushupSessionSchema.statics.getUserStats = async function (userId, dailyGoal) {
    const now = new Date(); // Current date and time
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Midnight of today
    const startOfWeek = new Date(startOfToday); // Copy for holding calculations
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay()); // Sunday (the start of this week)
    const endOfToday = new Date(startOfToday.getTime() + 86400000); // Midnight tomorrow (for precise "today" boundary)
    const endOfWeek = new Date(startOfWeek.getTime() + 7 * 86400000); // Next Sunday (for precise "this week" boundary)

    // Run 4 database queries in parallel
    // 1. Today's count
    // 2. This week's count
    // 3. Total count
    // 4. Calculate streak (consecutive days with pushups)
    const [todayResult, weekResult, totalResult, streakResult] = await Promise.all([
        // Today's count
        this.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    startedAt: {
                        $gte: startOfToday,  // >= midnight today
                        $lt: endOfToday      // < midnight tomorrow
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$count' }
                }
            }
        ]),

        // This week's count
        this.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    startedAt: {
                        $gte: startOfWeek,  // >= Sunday midnight
                        $lt: endOfWeek      // < next Sunday midnight
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$count' }
                }
            }
        ]),

        // Total count
        this.aggregate([
            {
                $match: { user: new mongoose.Types.ObjectId(userId) }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$count' }
                }
            }
        ]),

        // Calculate streak (consecutive days with pushups)
        this.aggregate([
            {
                $match: { user: new mongoose.Types.ObjectId(userId) } //grab all records for this user
            },
            {
                $group: { // group multiple sessions on the same day into one larger session with dailyCount
                    _id: {
                        year: { $year: '$startedAt' },
                        month: { $month: '$startedAt' },
                        day: { $dayOfMonth: '$startedAt' }
                    },
                    dailyCount: { $sum: '$count' }
                }
            },
            {
                $match: { dailyCount: { $gt: 0 } } // keep days with non-zero pushups
            },
            {
                $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } // sort by descending date (newest first)
            },
            {
                $limit: 365 // Only look at last year for performance (assumes no more than 365 days of data for a user)
            }
        ])
    ]);

    // Grab first results from each query
    const today = todayResult[0]?.total || 0;
    const week = weekResult[0]?.total || 0;
    const total = totalResult[0]?.total || 0;

    // Calculate streak from daily aggregations
    let streak = 0;
    const dailyData = streakResult;

    if (dailyData.length > 0) {
        const today = new Date();
        let currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        for (let i = 0; i < dailyData.length; i++) {
            const dayData = dailyData[i];
            const sessionDate = new Date(dayData._id.year, dayData._id.month - 1, dayData._id.day);

            if (sessionDate.getTime() === currentDate.getTime()) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else if (i === 0 && sessionDate.getTime() === currentDate.getTime() - 86400000) {
                // If first entry is yesterday, start counting from yesterday
                streak++;
                currentDate = new Date(sessionDate);
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                break;
            }
        }
    }

    return {
        today,
        week,
        total,
        streak,
        goalProgress: dailyGoal > 0 ? Math.round((today / dailyGoal) * 100) : 0
    };
};

module.exports = mongoose.model('PushupSession', pushupSessionSchema);

