const mongoose = require("mongoose");

const socialLinkSchema = new mongoose.Schema(
    {
        telegram: { type: String },
        whatsapp: { type: String },
        facebook: { type: String },
        instagram: { type: String },
        x: { type: String },
        email: { type: String },
        address: { type: String },
        mode: { type: String }, // e.g., 'production', 'development'
        credit_limit: { type: Number, default: 0 },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const SocialLink = mongoose.model("SocialLink", socialLinkSchema);

module.exports = SocialLink;
