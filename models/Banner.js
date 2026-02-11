const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
        },
        image_url: {
            type: String,
            required: true,
        },
        tournament: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tournament',
        },
        start_date: {
            type: Date,
            required: true,
        },
        end_date: {
            type: Date,
            required: true,
        },
        status: {
            type: Number,
            default: 1, // 1: Active, 0: Inactive, 2: Deleted
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const Banner = mongoose.model("Banner", bannerSchema);

module.exports = Banner;
