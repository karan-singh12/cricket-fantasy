require("dotenv").config();
const express = require("express");
const http = require("http");
// require('./cron/sportmonks'); // import to start CRONs
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const mongoose = require("mongoose");

const config = require("./config/config");
// const { knex, testConnection } = require("./config/database"); // Deprecated
const connectDB = require("./config/mongoose");
const initializeSocket = require("./socket/socket");

// Routes and middleware
const apiRoutes = require("./routes/index");
const languageMiddleware = require("./middleware/languageMiddleware");

// Create Express app
const app = express();
app.set("trust proxy", 1);

// Create ONE HTTP server and attach Socket.IO to it
const server = http.createServer(app);
const io = initializeSocket(server);

// Security middleware
app.use(helmet());
app.use(cors({ origin: "*" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
});
app.use(limiter);

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
app.use(morgan("dev"));

// Language middleware
app.use(languageMiddleware);

// Static
app.use("/public", express.static("public"));

// API routes
app.use("/api", apiRoutes);

// Health check
app.get("/api/health", async (req, res) => {
  try {
    // Check Mongo Connection
    const state = mongoose.connection.readyState;
    // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
    if (state !== 1) throw new Error("MongoDB not connected");

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      environment: config.env,
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: error.message,
    });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err : {},
  });
});

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    // await testConnection(); // Deprecated

    server.listen(config.port, () => {
      console.log(`Server running from PID: ${process.pid} at ${new Date().toISOString()}`);
      console.log(`Server running on port ${config.port}`);
    });

    // Monitor DB connection (Mongoose handles auto-reconnect, but we can log)
    mongoose.connection.on("disconnected", () => {
      console.error("MongoDB disconnected!");
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log("Shutting down...");
      server.close(async () => {
        try {
          await mongoose.connection.close();
          // await knex.destroy();
          process.exit(0);
        } catch (error) {
          console.error("Error during shutdown:", error.message);
          process.exit(1);
        }
      });

      // Force exit after 30s
      setTimeout(() => process.exit(1), 30000);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
