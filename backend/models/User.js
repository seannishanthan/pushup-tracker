const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); //library to hash password so if hacker gets access to database, they can't see the password

//here we define the schema (blueprint, class definition) for the User model (instance of the class)

const userSchema = new mongoose.Schema({
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
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'] //regex to validate email format, will later send email to user to verify
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long'],
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
    }
});

// before we save the user to the database, we want to hash the password for security
// this is a middleware function that runs before the save operation (runs in between the request and response)
// the request is the user object being saved and the response is the user object with the hashed password
userSchema.pre('save', async function(next) {

    if(!this.isModified('password')) return next(); //if password is not modified, skip hashing

    try {
        // hash password with salt and call next middleware function
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt); 
        next();

    } catch (error) {
        return next(error); //if there is an error, pass it to the next middleware
    }

});

// method of User schema to compare the candidate password entered by user with the hashed password in the database (this.password)
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// a model instance method to get the user data without the password field
userSchema.methods.getPublicProfile = function() {
    return {
        id: this._id, //every mongoose document (User / row in database) has an _id field built in
        username: this.username,
        email: this.email,
        createdAt: this.createdAt,
        totalSessions: this.totalSessions,
        totalPushups: this.totalPushups
    };
};

//create a model called User using the userSchema and export it to be used in other files
module.exports = mongoose.model('User', userSchema);