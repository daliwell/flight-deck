const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Configure Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if user's email domain is sandsmedia.com
        const email = profile.emails[0].value;
        const domain = email.split('@')[1];
        
        if (domain !== 'sandsmedia.com') {
            return done(null, false, { 
                message: 'Access denied. Only sandsmedia.com domain accounts are allowed.' 
            });
        }

        // Create user object with profile information
        const user = {
            id: profile.id,
            email: email,
            name: profile.displayName,
            picture: profile.photos[0].value,
            domain: domain
        };

        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user);
});

// Deserialize user from session
passport.deserializeUser((user, done) => {
    done(null, user);
});

module.exports = passport;