const mongoose = require("mongoose");

const fantasyPointSchema = new mongoose.Schema(
    {
        action: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        points: {
            type: Number,
            required: true,
        },
        description: {
            type: String,
            trim: true,
        },
        conditions: {
            type: mongoose.Schema.Types.Mixed,
        },
        points_t20: {
            type: Number,
            default: 0,
        },
        points_odi: {
            type: Number,
            default: 0,
        },
        points_test: {
            type: Number,
            default: 0,
        },
        points_t10: {
            type: Number,
            default: 0,
        },
        status: {
            type: Number,
            default: 1, // 1 for active, 2 for deleted (per original logic)
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const FantasyPoint = mongoose.model("FantasyPoint", fantasyPointSchema);

module.exports = FantasyPoint;
