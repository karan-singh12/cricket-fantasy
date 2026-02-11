const mongoose = require("mongoose");

const emailTemplateSchema = new mongoose.Schema(
    {
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
            ref: "Admin", // Assuming Admin model exists or will be created
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const EmailTemplate = mongoose.model("EmailTemplate", emailTemplateSchema);

module.exports = EmailTemplate;
