const mongoose = require("mongoose");

const kycVerificationSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            unique: true,
        },
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

// Transform to return numeric id and hide _id
kycVerificationSchema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

kycVerificationSchema.set("toObject", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

// Auto-increment numeric id
const Counter = require("./Counter");
kycVerificationSchema.pre("save", async function () {
    if (!this.id) {
        const counter = await Counter.findByIdAndUpdate(
            { _id: "kycVerificationId" },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        this.id = counter.seq;
    }
});

const KycVerification = mongoose.model("KycVerification", kycVerificationSchema);

module.exports = KycVerification;
