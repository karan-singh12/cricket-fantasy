const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            unique: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        balance: {
            type: Number,
            default: 0,
            required: true,
        },
        bonus_balance: {
            type: Number,
            default: 0,
        },
        currency: {
            type: String,
            default: "BDT",
        },
        status: {
            type: Number,
            default: 1, // 1: active, 0: inactive
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const Wallet = mongoose.model("Wallet", walletSchema);

module.exports = Wallet;
