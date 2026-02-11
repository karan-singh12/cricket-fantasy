const mongoose = require("mongoose");

const venueSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        city: {
            type: String,
            trim: true,
        },
        country_id: {
            type: Number,
        },
        venue_id: {
            type: Number,
            unique: true,
        },
        image_path: {
            type: String,
        },
        capacity: {
            type: Number,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const Venue = mongoose.model("Venue", venueSchema);

module.exports = Venue;
