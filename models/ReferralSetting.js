const mongoose = require("mongoose");

const referralSettingSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            unique: true,
        },
        is_active: {
            type: Boolean,
            default: true,
        },
        referrer_bonus: {
            type: Number,
            required: true,
            default: 0,
        },
        referee_bonus: {
            type: Number,
            required: true,
            default: 0,
        },
        max_referrals_per_user: {
            type: Number,
            default: 0, // 0 for unlimited
        },
        min_referee_verification: {
            type: Boolean,
            default: true, // Require verification for bonus
        },
        bonus_currency: {
            type: String,
            default: "BDT",
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

// Transform to return numeric id and hide _id
referralSettingSchema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

referralSettingSchema.set("toObject", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

// Auto-increment numeric id
const Counter = require("./Counter");
referralSettingSchema.pre("save", async function () {
    if (!this.id) {
        const counter = await Counter.findByIdAndUpdate(
            { _id: "referralSettingId" },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        this.id = counter.seq;
    }
});

const ReferralSetting = mongoose.model("ReferralSetting", referralSettingSchema);

module.exports = ReferralSetting;
