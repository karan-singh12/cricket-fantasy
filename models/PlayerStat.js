const mongoose = require("mongoose");

const playerStatSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            unique: true,
        },
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

// Transform to return numeric id and hide _id
playerStatSchema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

playerStatSchema.set("toObject", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

// Auto-increment numeric id
const Counter = require("./Counter");
playerStatSchema.pre("save", async function () {
    if (!this.id) {
        const counter = await Counter.findByIdAndUpdate(
            { _id: "playerStatId" },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        this.id = counter.seq;
    }
});

// Compound index
playerStatSchema.index({ match: 1, player: 1 }, { unique: true });

const PlayerStat = mongoose.model("PlayerStat", playerStatSchema);

module.exports = PlayerStat;
