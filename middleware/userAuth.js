const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { knex: db } = require('../config/database');
const apiResponse = require("../utils/apiResponse");
const { slugGenrator, listing } = require("../utils/functions");
const { AUTH, ERROR, SUCCESS } = require("../utils/responseMsg");
const User = require('../models/User');

const userAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).send({ status: false, message: AUTH.tokenRequired });
        }

        const token = authHeader.split(' ')[1];

        const decoded = jwt.verify(token, config.jwtSecret);

        if (decoded.role !== 'user') {
            return res.status(403).json({ status: false, error: 'Not authorized' });
        }


        // Try lookup by numeric id first, then falls back to _id if decoded.id looks like an ObjectId
        let user;
        if (mongoose.Types.ObjectId.isValid(decoded.id)) {
            user = await User.findOne({ _id: decoded.id });
        } else {
            user = await User.findOne({ id: decoded.id });
        }

        console.log("user", user);

        if (!user) {
            return res.status(401).send({ status: false, message: AUTH.tokenExpired });
        }

        if (!user.is_verified) {
            return res.status(403).json({ status: false, message: 'Email not verified' });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).send({ status: 401, message: AUTH.tokenExpired });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).send({ status: 401, message: AUTH.tokenExpired });
        }
    }
};

module.exports = userAuth; 