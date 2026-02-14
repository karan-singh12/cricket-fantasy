const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            unique: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        content: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            default: "general", // 'referral_bonus', 'contest_winner', etc.
        },
        is_read: {
            type: Boolean,
            default: false,
        },
        match_id: {
            type: Number,
        },
        sent_at: {
            type: Date,
            default: Date.now,
        },
        read_at: {
            type: Date,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
