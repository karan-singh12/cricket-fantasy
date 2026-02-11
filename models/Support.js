const mongoose = require("mongoose");

const supportSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            // Optional, as guest users might contact support
        },
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
        },
        // from: "Website" or "App"
        from: {
            type: String,
            default: "Website",
        },
        type: {
            type: String, // 'Bug', 'Feature Request', 'General Inquiry'
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        status: {
            type: Number,
            default: 1, // 1: Open, 2: Resolved, 0: Closed
        },
        response: {
            type: String, // Admin response
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const Support = mongoose.model("Support", supportSchema);

module.exports = Support;
