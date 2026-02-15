const jwt = require("jsonwebtoken");
const { knex: db } = require('../config/database');
const config = require("../config/config");

const verifySocketToken = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error("Authentication error: Token required"));
    }

    // Verify once
    const decoded = jwt.verify(token, config.jwtSecret);

    // Require role
    if (!decoded?.role) {
      return next(new Error("Authentication error: Invalid token format"));
    }

    // Normalize user id across tokens that might use id or _id
    const userId = decoded.id ?? decoded._id;
    if (!userId) {
      return next(new Error("Authentication error: Invalid token payload (missing id)"));
    }

    const table = decoded.role === "admin" ? "admins" : "users";
    const user = await db(table).where({ id: userId }).select("*").first();

    if (!user) {
      return next(new Error("Authentication error: User not found"));
    }

    // Remove sensitive fields
    if (user.password) delete user.password;

    // Attach to socket
    socket.user = user;
    socket.role = decoded.role;

    next();
  } catch (error) {
    console.error("Socket Auth Error:", error.message);
    return next(new Error("Authentication error: Invalid token"));
  }
};

module.exports = verifySocketToken;
