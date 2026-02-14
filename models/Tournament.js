const mongoose = require("mongoose");

const tournamentSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            unique: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        short_name: {
            type: String,
        },
        sportmonks_id: {
            type: Number,
            unique: true,
        },
        start_date: {
            type: Date,
        },
        end_date: {
            type: Date,
        },
        type: {
            type: String, // 'league', 'cup'
        },
        seasonId: {
            type: Number,
        },
        season: {
            type: String, // e.g., '2023/24'
        },
        status: {
            type: String, // 'active', 'completed'
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

// Transform to return numeric id and hide _id
tournamentSchema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

tournamentSchema.set("toObject", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

const Tournament = mongoose.model("Tournament", tournamentSchema);

module.exports = Tournament;
