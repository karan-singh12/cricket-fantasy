const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            trim: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            index: true,
        },
        phone: {
            type: String,
            trim: true,
            index: true,
        },
        password: {
            type: String,
        },
        role: {
            type: String,
            default: "user",
            enum: ["user", "admin", "moderator"],
        },
        balance: {
            type: Number,
            default: 0,
        },
        wallet_balance: {
            type: Number,
            default: 0,
        },
        status: {
            type: Number,
            default: 1, // 1: active, 0: inactive, 2: deleted/blocked
        },
        ftoken: {
            type: String,
        },
        google_id: {
            type: String,
        },
        social_login_type: {
            type: String,
        },
        device_id: {
            type: String,
        },
        device_type: {
            type: String,
        },
        is_name_setup: {
            type: Boolean,
            default: false,
        },
        is_verified: {
            type: Boolean,
            default: false,
        },
        referral_code: {
            type: String,
            unique: true,
            sparse: true,
        },
        referred_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        referral_bonus: {
            type: Number,
            default: 0,
        },
        otp: {
            type: String,
        },
        otp_expires: {
            type: Date,
        },
        reset_password_token: {
            type: String,
        },
        reset_password_expires: {
            type: Date,
        },
        last_login: {
            type: Date,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

// Hash password before saving
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, 10);
});

// Method to compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
