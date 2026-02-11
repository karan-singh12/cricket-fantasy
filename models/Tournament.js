const mongoose = require("mongoose");

const tournamentSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        short_name: {
            type: String,
        },
        sportmonks_id: {
            type: Number,
            unique: true,
        },
        start_date: {
            type: Date,
        },
        end_date: {
            type: Date,
        },
        type: {
            type: String, // 'league', 'cup'
        },
        status: {
            type: String, // 'active', 'completed'
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const Tournament = mongoose.model("Tournament", tournamentSchema);

module.exports = Tournament;
