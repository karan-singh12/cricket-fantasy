const mongoose = require("mongoose");

const emailTemplateSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            unique: true,
        },
        title: {
            type: String,
            required: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        subject: {
            type: String,
            required: true,
        },
        content: {
            type: String, // HTML content
            required: true,
        },
        status: {
            type: Number,
            default: 1, // 1: Active
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

// Transform to return numeric id and hide _id
emailTemplateSchema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

emailTemplateSchema.set("toObject", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

// Auto-increment numeric id
const Counter = require("./Counter");
emailTemplateSchema.pre("save", async function () {
    if (!this.id) {
        const counter = await Counter.findByIdAndUpdate(
            { _id: "emailTemplateId" },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        this.id = counter.seq;
    }
});

const EmailTemplate = mongoose.model("EmailTemplate", emailTemplateSchema);

module.exports = EmailTemplate;
