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

// Transform to return numeric id and hide _id
playerTeamSchema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

playerTeamSchema.set("toObject", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

// Auto-increment numeric id (Fallback if not set during sync)
const Counter = require("./Counter");
playerTeamSchema.pre("save", async function () {
    if (!this.id) {
        const counter = await Counter.findByIdAndUpdate(
            { _id: "playerTeamId" },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        this.id = counter.seq;
    }
});

const PlayerTeam = mongoose.model("PlayerTeam", playerTeamSchema);

module.exports = PlayerTeam;
