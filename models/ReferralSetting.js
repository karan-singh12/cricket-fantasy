const mongoose = require("mongoose");

const referralSettingSchema = new mongoose.Schema(
    {
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

const ReferralSetting = mongoose.model("ReferralSetting", referralSettingSchema);

module.exports = ReferralSetting;
