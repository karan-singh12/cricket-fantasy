const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema(
    {
        sportmonks_id: {
            type: Number,
            required: true,
            unique: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        short_name: {
            type: String,
            trim: true,
        },
        image_url: {
            type: String,
        },
        position: {
            type: String, // 'Batsman', 'Bowler', 'All-Rounder', 'Wicketkeeper'
        },
        team: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Team",
        },
        country_id: {
            type: Number,
        },
        date_of_birth: {
            type: Date,
        },
        points: {
            type: Number,
            default: 0,
        },
        credits: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const Player = mongoose.model("Player", playerSchema);

module.exports = Player;
