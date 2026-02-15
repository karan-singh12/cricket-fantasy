const jwt = require('jsonwebtoken');
const { knex } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'; // In production, use environment variable

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
      
        if (!token) {
            throw new Error('Authentication required');
        }

        const decoded = jwt.verify(token, JWT_SECRET);
      

        // Check if user is admin
        if (decoded.role === 'admin') {
            const admin = await knex('admins')
                .where('id', decoded.id)
                .first();

            if (!admin) {
                throw new Error('Admin not found');
            }

            req.token = token;
            req.user = admin;
            req.user.role = 'admin';
            return next();
        }

        // Check if user is regular user
        const user = await knex('users')
            .where('id', decoded.id)
            .first();

        if (!user) {
            throw new Error('User not found');
        }

        req.token = token;
        req.user = user;
        req.user.role = 'user';
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

        if (!roles.includes(req.user.role)) {
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