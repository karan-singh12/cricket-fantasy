const jwt = require("jsonwebtoken");
const config = require("../config/config");
const User = require("../models/User");
const Admin = require("../models/Admin");

const verifySocketToken = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    // Allow connection without token? No, middleware enforces it.
    if (!token) {
      return next(new Error("Authentication error: Token required"));
    }

    // Verify once
    const decoded = jwt.verify(token, config.jwtSecret);

    // Require role? The original code required role.
    // decoded might look like { id: '...', role: 'user', iat: ..., exp: ... }

    const userId = decoded.id ?? decoded._id;

    if (!userId) {
      return next(new Error("Authentication error: Invalid token payload (missing id)"));
    }

    let user;
    if (decoded.role === "admin") {
      user = await Admin.findById(userId).select("-password").lean();
    } else {
      user = await User.findById(userId).select("-password").lean();
    }

    if (!user) {
      return next(new Error("Authentication error: User not found"));
    }

    // Attach to socket (using _id as id for compatibility if needed, but Mongoose has _id)
    socket.user = { ...user, id: user._id.toString() };
    socket.role = decoded.role || (decoded.isAdmin ? "admin" : "user");

    next();
  } catch (error) {
    console.error("Socket Auth Error:", error.message);
    return next(new Error("Authentication error: Invalid token"));
  }
};

module.exports = verifySocketToken;
