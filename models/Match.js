const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            unique: true,
        },
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
        end_time: {
            type: Date,
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
        venue: {
            type: String,
        },
        city: {
            type: String,
        },
        country: {
            type: String,
        },
        match_number: {
            type: String,
        },
        match_type: {
            type: String,
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
        toss: {
            type: String,
        },
        man_of_match: {
            type: String,
        },
        referee: {
            type: String,
        },
        scorecard: {
            type: Object,
        },
        metadata: {
            type: Object,
        },
        sm_match_id: {
            type: Number,
        }
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

// Transform to return numeric id and hide _id
matchSchema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

matchSchema.set("toObject", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

const Match = mongoose.model("Match", matchSchema);

module.exports = Match;
