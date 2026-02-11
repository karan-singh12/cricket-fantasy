const mongoose = require("mongoose");

const countrySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        image_path: {
            type: String,
        },
        country_id: {
            type: Number,
            unique: true,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const Country = mongoose.model("Country", countrySchema);

module.exports = Country;
