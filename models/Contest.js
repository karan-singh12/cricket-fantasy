const mongoose = require("mongoose");

const contestSchema = new mongoose.Schema(
    {
        match: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Match",
            required: true,
        },
        template_id: {
            type: Number, // Reference to contest template
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
            type: String, // or Object for prize breakup text
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const Contest = mongoose.model("Contest", contestSchema);

module.exports = Contest;
