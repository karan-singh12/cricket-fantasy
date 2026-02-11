const mongoose = require("mongoose");

const notificationTemplateSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
        },
        content: {
            type: String,
            required: true,
        },
        notification_type: {
            type: String,
            required: true,
            index: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        status: {
            type: Number,
            default: 1, // 1: Active, 0: Inactive, 2: Deleted
        },
        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "modified_at" },
    }
);

const NotificationTemplate = mongoose.model("NotificationTemplate", notificationTemplateSchema);

module.exports = NotificationTemplate;
