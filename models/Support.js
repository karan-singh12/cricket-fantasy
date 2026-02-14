const mongoose = require("mongoose");

const supportSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            unique: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            // Optional, as guest users might contact support
        },
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
        },
        // from: "Website" or "App"
        from: {
            type: String,
            default: "Website",
        },
        type: {
            type: String, // 'Bug', 'Feature Request', 'General Inquiry'
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        status: {
            type: Number,
            default: 1, // 1: Open, 2: Resolved, 0: Closed
        },
        response: {
            type: String, // Admin response
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

// Transform to return numeric id and hide _id
supportSchema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

supportSchema.set("toObject", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

// Auto-increment numeric id
const Counter = require("./Counter");
supportSchema.pre("save", async function () {
    if (!this.id) {
        const counter = await Counter.findByIdAndUpdate(
            { _id: "supportId" },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        this.id = counter.seq;
    }
});

const Support = mongoose.model("Support", supportSchema);

module.exports = Support;
