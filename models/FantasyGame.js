const mongoose = require("mongoose");

const fantasyGameSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            unique: true,
        },
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

// Transform to return numeric id and hide _id
fantasyGameSchema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

fantasyGameSchema.set("toObject", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

// Auto-increment numeric id
const Counter = require("./Counter");
fantasyGameSchema.pre("save", async function () {
    if (!this.id) {
        const counter = await Counter.findByIdAndUpdate(
            { _id: "fantasyGameId" },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        this.id = counter.seq;
    }
});

const FantasyGame = mongoose.model("FantasyGame", fantasyGameSchema);

module.exports = FantasyGame;
