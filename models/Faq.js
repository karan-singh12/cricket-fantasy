const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            unique: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
        },
        category: {
            type: String,
            trim: true,
        },
        status: {
            type: Number,
            default: 1, // 1: Active, 0: Inactive, 2: Deleted
        },
        order: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

// Transform to return numeric id and hide _id
faqSchema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

faqSchema.set("toObject", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

// Auto-increment numeric id
const Counter = require("./Counter");
faqSchema.pre("save", async function () {
    if (!this.id) {
        const counter = await Counter.findByIdAndUpdate(
            { _id: "faqId" },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        this.id = counter.seq;
    }
});

const Faq = mongoose.model("FAQ", faqSchema);

module.exports = Faq;
