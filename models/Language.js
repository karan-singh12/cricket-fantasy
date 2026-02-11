const mongoose = require("mongoose");

const languageSchema = new mongoose.Schema(
    {
        language_type: {
            type: String,
            required: true,
            unique: true,
            uppercase: true, // EN, HI, etc.
        },
        name: {
            type: String,
            required: true,
            trim: true,
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

const Language = mongoose.model("Language", languageSchema);

module.exports = Language;
