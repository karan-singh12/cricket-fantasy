const mongoose = require("mongoose");

const screenshotSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        file_url: {
            type: String,
            required: true,
        },
        file_type: {
            type: String,
            enum: ["image", "video"],
            required: true,
        },
        status: {
            type: Number,
            default: 1, // 1: Active, 0: Inactive
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const Screenshot = mongoose.model("Screenshot", screenshotSchema);

module.exports = Screenshot;
