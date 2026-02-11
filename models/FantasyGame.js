const mongoose = require("mongoose");

const fantasyGameSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        contest: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Contest",
            required: true,
        },
        fantasy_team: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "FantasyTeam",
            required: true,
        },
        rank: {
            type: Number,
            default: 0,
        },
        points: {
            type: Number,
            default: 0.0,
        },
        winnings: {
            type: Number,
            default: 0,
        },
        status: {
            type: String, // 'joined', 'completed'
            default: "joined",
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const FantasyGame = mongoose.model("FantasyGame", fantasyGameSchema);

module.exports = FantasyGame;
