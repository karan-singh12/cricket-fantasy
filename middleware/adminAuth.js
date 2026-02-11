const { auth } = require('./auth');

const adminAuth = async (req, res, next) => {
    try {
        // First run the regular auth middleware
        await auth(req, res, async () => {
            // Check if user is admin
            if (req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
            }
            next();
        });
    } catch (error) {
        res.status(401).json({ error: 'Authentication failed' });
    }
};

module.exports = adminAuth; 