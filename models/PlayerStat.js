const mongoose = require("mongoose");

const playerStatSchema = new mongoose.Schema(
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
        fantasy_points: {
            type: Number,
            default: 0,
        },
        runs_scored: {
            type: Number,
            default: 0,
        },
        wickets: {
            type: Number,
            default: 0,
        },
        catches: {
            type: Number,
            default: 0,
        },
        stumpings: {
            type: Number,
            default: 0,
        },
        run_outs: {
            type: Number,
            default: 0,
        },
        fours: { type: Number, default: 0 },
        sixes: { type: Number, default: 0 },
        overs: { type: Number, default: 0 },
        maiden_overs: { type: Number, default: 0 },
        economy: { type: Number, default: 0 },
        is_duck: { type: Boolean, default: false },
        batting_status: { type: String }, // e.g., 'not out', 'bowled'
        bowling_status: { type: String },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

// Compound index
playerStatSchema.index({ match: 1, player: 1 }, { unique: true });

const PlayerStat = mongoose.model("PlayerStat", playerStatSchema);

module.exports = PlayerStat;
