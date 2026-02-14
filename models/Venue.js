const mongoose = require("mongoose");

const venueSchema = new mongoose.Schema(
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
        city: {
            type: String,
            trim: true,
        },
        country_id: {
            type: Number,
        },
        venue_id: {
            type: Number,
            unique: true,
        },
        image_path: {
            type: String,
        },
        capacity: {
            type: Number,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

// Transform to return numeric id and hide _id
venueSchema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

venueSchema.set("toObject", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

// Auto-increment numeric id
const Counter = require("./Counter");
venueSchema.pre("save", async function () {
    if (!this.id) {
        const counter = await Counter.findByIdAndUpdate(
            { _id: "venueId" },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        this.id = counter.seq;
    }
});

const Venue = mongoose.model("Venue", venueSchema);

module.exports = Venue;
