const mongoose = require("mongoose");

const howToPlaySchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            unique: true,
        },
        tab: {
            type: String,
            required: true,
            trim: true,
        },
        title: {
            type: String,
            trim: true,
        },
        content: {
            type: String,
        },
        banner_image: {
            type: String,
        },
        data: {
            type: mongoose.Schema.Types.Mixed,
        },
        status: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

// Transform to return numeric id and hide _id
howToPlaySchema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

howToPlaySchema.set("toObject", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

// Auto-increment numeric id
const Counter = require("./Counter");
howToPlaySchema.pre("save", async function () {
    if (!this.id) {
        const counter = await Counter.findByIdAndUpdate(
            { _id: "howToPlayId" },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        this.id = counter.seq;
    }
});

const HowToPlay = mongoose.model("HowToPlay", howToPlaySchema);

module.exports = HowToPlay;
