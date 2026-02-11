const mongoose = require("mongoose");

const kycVerificationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        pan_number: {
            type: String,
            required: true,
        },
        pan_name: {
            type: String,
            required: true,
        },
        pan_front_url: {
            type: String,
            required: true,
        },
        pan_back_url: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ["pending", "verified", "rejected"],
            default: "pending",
        },
        rejection_reason: {
            type: String,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const KycVerification = mongoose.model("KycVerification", kycVerificationSchema);

module.exports = KycVerification;
