const mongoose = require("mongoose");

const matchPlayerSchema = new mongoose.Schema(
    {
        match: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Match",
            required: true,
        },
        player: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Player",
            required: true,
        },
        team: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Team",
            required: true,
        },
        is_playing_xi: {
            type: Boolean,
            default: false,
        },
        is_substitute: {
            type: Boolean,
            default: false,
        },
        role: {
            type: String
        }
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

// Compound index for uniqueness
matchPlayerSchema.index({ match: 1, player: 1 }, { unique: true });

const MatchPlayer = mongoose.model("MatchPlayer", matchPlayerSchema);

module.exports = MatchPlayer;
