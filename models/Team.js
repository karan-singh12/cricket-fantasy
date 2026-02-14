const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema(
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
            trim: true,
        },
        logo_url: {
            type: String,
        },
        type: {
            type: String, // 'national', 'club'
        },
        country_id: {
            type: Number,
        },
        sportmonks_id: {
            type: Number,
            required: true,
            unique: true,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

// Transform to return numeric id and hide _id
teamSchema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

teamSchema.set("toObject", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

const Team = mongoose.model("Team", teamSchema);

module.exports = Team;
