const mongoose = require('mongoose');

//here we define the schema (blueprint, class definition) for the User model (instance of the class)

const userSchema = new mongoose.Schema({
    uid: {
        type: String,
        required: [true, 'Firebase UID is required'],
        unique: true,
        trim: true
    },
    username: {
        type: String,
        required: [true, 'Username is required'], //required field, if not provided, will throw an error with this message
        unique: true,
        trim: true, //remove whitespace from beginning and end
        minlength: [3, 'Username must be at least 3 characters long'],
        maxlength: [20, 'Username must be at most 20 characters long']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true, //convert to lowercase
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'] //regex to validate email format
    },
    createdAt: {
        type: Date,
        default: Date.now //default value is current date and time
    },
    totalSessions: {
        type: Number,
        default: 0 //default value is 0
    },
    totalPushups: {
        type: Number,
        default: 0 //default value is 0
    },
    dailyGoal: {
        type: Number,
        default: 20 //default daily goal is 20 pushups
    }
});

// a model instance method to get the user data without sensitive fields
userSchema.methods.getPublicProfile = function () {
    return {
        id: this._id, //every mongoose document (User / row in database) has an _id field built in
        uid: this.uid, // Firebase UID
        username: this.username,
        email: this.email,
        createdAt: this.createdAt,
        totalSessions: this.totalSessions,
        totalPushups: this.totalPushups,
        dailyGoal: this.dailyGoal
    };
};

//create a model called User using the userSchema and export it to be used in other files
module.exports = mongoose.model('User', userSchema);