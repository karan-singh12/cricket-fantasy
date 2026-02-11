const mongoose = require("mongoose");

const appDownloadSchema = new mongoose.Schema(
    {
        file_name: {
            type: String,
            required: true,
        },
        file_path: {
            type: String,
            required: true,
        },
        current_version: {
            type: String,
            required: true,
        },
        previous_version: {
            type: String,
            required: true,
        },
        platform: {
            type: String,
            enum: ["android", "ios", "unknown"],
            default: "unknown",
        },
        ios_app_store_link: {
            type: String,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const AppDownload = mongoose.model("AppDownload", appDownloadSchema);

module.exports = AppDownload;
