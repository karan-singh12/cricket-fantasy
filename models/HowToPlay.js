const mongoose = require("mongoose");

const howToPlaySchema = new mongoose.Schema(
    {
        tab: {
            type: String,
            required: true,
            trim: true,
        },
        title: {
            type: String,
            trim: true,
        },
        content: {
            type: String, // Or can be an object/array structure if it's complex JSON
        },
        banner_image: {
            type: String,
        },
        data: {
            type: mongoose.Schema.Types.Mixed, // Storing the complex JSON structure described in controller
        },
        status: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const HowToPlay = mongoose.model("HowToPlay", howToPlaySchema);

module.exports = HowToPlay;
