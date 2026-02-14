const mongoose = require("mongoose");

const matchPlayerSchema = new mongoose.Schema(
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

// Transform to return numeric id and hide _id
matchPlayerSchema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

matchPlayerSchema.set("toObject", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

// Auto-increment numeric id
const Counter = require("./Counter");
matchPlayerSchema.pre("save", async function () {
    if (!this.id) {
        const counter = await Counter.findByIdAndUpdate(
            { _id: "matchPlayerId" },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        this.id = counter.seq;
    }
});

// Compound index for uniqueness
matchPlayerSchema.index({ match: 1, player: 1 }, { unique: true });

const MatchPlayer = mongoose.model("MatchPlayer", matchPlayerSchema);

module.exports = MatchPlayer;
