// Middleware to ensure user is authenticated
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    
    // Store the original URL to redirect back after login
    req.session.returnTo = req.originalUrl;
    res.redirect('/auth/login');
};

// Middleware to ensure user is from sandsmedia.com domain
const ensureSandsMediaDomain = (req, res, next) => {
    if (req.isAuthenticated() && req.user && req.user.domain === 'sandsmedia.com') {
        return next();
    }
    
    res.status(403).json({
        success: false,
        message: 'Access denied. Only sandsmedia.com domain accounts are allowed.'
    });
};

// Combined middleware for both authentication and domain check
const requireSandsMediaAuth = [ensureAuthenticated, ensureSandsMediaDomain];

module.exports = {
    ensureAuthenticated,
    ensureSandsMediaDomain,
    requireSandsMediaAuth
};