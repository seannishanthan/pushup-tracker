const mongoose = require('mongoose');

//here we define the schema (blueprint, class definition) for the User model (instance of the class)

const userSchema = new mongoose.Schema({
    uid: {
        type: String,
        required: [true, 'Firebase UID is required'],
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: [true, 'Name is required'], //required field, if not provided, will throw an error with this message
        trim: true, //remove whitespace from beginning and end
        minlength: [2, 'Name must be at least 2 characters long'],
        maxlength: [50, 'Name must be at most 50 characters long'],
        validate: {
            validator: function (v) {
                // Check that name has no spaces
                return !/\s/.test(v);
            },
            message: 'Name cannot contain spaces'
        }
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
    dailyGoal: {
        type: Number,
        default: 20 //default daily goal is 20 pushups
    }
});

// Pre-save middleware to format name consistently
userSchema.pre('save', function (next) {
    if (this.name && this.isModified('name')) {
        // Format name: capitalize first letter, lowercase rest
        this.name = this.name.charAt(0).toUpperCase() + this.name.slice(1).toLowerCase();
    }
    next();
});

// a model instance method to get the user data without sensitive fields
userSchema.methods.getPublicProfile = function () {
    return {
        id: this._id, //every mongoose document (User / row in database) has an _id field built in
        uid: this.uid, // Firebase UID
        name: this.name,
        email: this.email,
        createdAt: this.createdAt,
        dailyGoal: this.dailyGoal
    };
};

//create a model called User using the userSchema and export it to be used in other files
module.exports = mongoose.model('User', userSchema);