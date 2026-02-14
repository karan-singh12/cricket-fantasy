const mongoose = require("mongoose");

const playerTeamSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            unique: true,
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
        season_id: {
            type: Number, // Sportmonks Season ID (not a model ref for now)
            required: true,
        },
        is_active: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

// Compound index for uniqueness
playerTeamSchema.index({ player: 1, team: 1, season_id: 1 }, { unique: true });

const PlayerTeam = mongoose.model("PlayerTeam", playerTeamSchema);

module.exports = PlayerTeam;
