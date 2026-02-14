const mongoose = require("mongoose");

const contestSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            unique: true,
        },
        name: {
            type: String,
            required: true,
        },
        match: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Match",
            required: true,
        },
        tournament: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tournament",
        },
        template_id: {
            type: Number,
        },
        entry_fee: {
            type: Number,
            required: true,
        },
        prize_pool: {
            type: Number,
            required: true,
        },
        max_teams: {
            type: Number,
            required: true,
        },
        joined_teams: {
            type: Number,
            default: 0,
        },
        max_teams_per_user: {
            type: Number,
            default: 1,
        },
        contest_type: {
            type: String, // 'guaranteed', 'normal'
        },
        winnings: {
            type: Object, // Prize distribution structure { "1": 500, "2": 300 }
        },
        commission_percentage: {
            type: Number,
        },
        total_spots: {
            type: Number,
        },
        per_user_entry: {
            type: Number,
        },
        filled_spots: {
            type: Number,
            default: 0,
        },
        status: {
            type: String,
            enum: ["upcoming", "cancelled", "completed", "live"],
            default: "upcoming",
        },
        is_mega_contest: {
            type: Boolean,
            default: false,
        },
        created_by_user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        start_time: {
            type: Date,
        },
        end_time: {
            type: Date,
        },
        rules: {
            type: String,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

// Transform to return numeric id and hide _id
contestSchema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

contestSchema.set("toObject", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

// Auto-increment numeric id
const Counter = require("./Counter");
contestSchema.pre("save", async function () {
    if (!this.id) {
        const counter = await Counter.findByIdAndUpdate(
            { _id: "contestId" },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        this.id = counter.seq;
    }
});

const Contest = mongoose.model("Contest", contestSchema);

module.exports = Contest;
