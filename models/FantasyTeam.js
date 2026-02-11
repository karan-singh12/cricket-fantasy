const mongoose = require("mongoose");

const fantasyTeamSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        match: {
            type: mongoose.Schema.Types.ObjectId, // Or Number if using Sportmonks ID
            ref: "Match",
            required: true,
        },
        name: {
            type: String,
            default: "T1",
        },
        captain_id: {
            type: Number, // Player ID
            required: true,
        },
        vice_captain_id: {
            type: Number, // Player ID
            required: true,
        },
        players: [
            {
                player: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Player",
                    required: true,
                },
                is_captain: { type: Boolean, default: false },
                is_vice_captain: { type: Boolean, default: false },
                is_substitute: { type: Boolean, default: false }, // Added for consistency with controller usage
            },
        ],
        total_points: {
            type: Number,
            default: 0.0,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const FantasyTeam = mongoose.model("FantasyTeam", fantasyTeamSchema);

module.exports = FantasyTeam;
