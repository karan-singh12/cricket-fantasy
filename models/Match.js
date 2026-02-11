const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema(
    {
        sportmonks_id: {
            type: Number,
            required: true,
            unique: true,
        },
        title: {
            type: String,
        },
        short_title: {
            type: String,
        },
        tournament: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tournament",
        },
        team1: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Team",
        },
        team2: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Team",
        },
        start_time: {
            type: Date,
            required: true,
        },
        status: {
            type: String, // 'NS', '1st Innings', '2nd Innings', 'Completed'
        },
        format: {
            type: String, // 'ODI', 'T20', 'Test'
        },
        venue_id: {
            type: Number,
        },
        toss_won_team_id: {
            type: Number,
        },
        toss_decision: {
            type: String, // 'bat', 'bowl'
        },
        score_team1: {
            type: String,
        },
        score_team2: {
            type: String,
        },
        overs_team1: {
            type: String,
        },
        overs_team2: {
            type: String,
        },
        winning_team_id: {
            type: Number,
        },
        man_of_the_match_id: {
            type: Number,
        },
        result_note: {
            type: String,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const Match = mongoose.model("Match", matchSchema);

module.exports = Match;
