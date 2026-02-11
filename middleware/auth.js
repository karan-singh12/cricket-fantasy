const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            throw new Error('Authentication required');
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        // Check if user is admin or user based on decoded payload or DB lookup
        // Assuming decoded.role exists as per authController.js jwt.sign

        let user;
        if (decoded.role === 'admin') {
            user = await Admin.findById(decoded.id || decoded.userId);
            // In SQL it was `id`, Mongoose uses `_id` but we can query by `_id`. 
            // AuthController signed with `id: user._id`.

            if (!user) {
                throw new Error('Admin not found');
            }
            req.user = user;
            req.user.role = 'admin';
        } else {
            user = await User.findById(decoded.id || decoded.userId);
            if (!user) {
                throw new Error('User not found');
            }
            req.user = user;
            req.user.role = 'user';
        }

        req.token = token;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Please authenticate' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Please authenticate' });
        }

        // Check if user role is in allowed roles
        // Mongoose document might need .role access directly
        const userRole = req.user.role || 'user';

        if (!roles.includes(userRole)) {
            return res.status(403).json({ error: 'Not authorized to access this resource' });
        }

        next();
    };
};

module.exports = {
    auth,
    authorize,
    JWT_SECRET
};