const mongoose = require("mongoose");

const fantasyTeamSchema = new mongoose.Schema(
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
        match: {
            type: mongoose.Schema.Types.ObjectId,
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
                is_substitute: { type: Boolean, default: false },
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

// Transform to return numeric id and hide _id
fantasyTeamSchema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

fantasyTeamSchema.set("toObject", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

// Auto-increment numeric id
const Counter = require("./Counter");
fantasyTeamSchema.pre("save", async function () {
    if (!this.id) {
        const counter = await Counter.findByIdAndUpdate(
            { _id: "fantasyTeamId" },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        this.id = counter.seq;
    }
});

const FantasyTeam = mongoose.model("FantasyTeam", fantasyTeamSchema);

module.exports = FantasyTeam;
