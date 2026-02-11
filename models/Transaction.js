const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            default: "BDT",
        },
        status: {
            type: String,
            enum: ["SUCCESS", "FAILED", "PENDING", "CANCELLED"],
            default: "PENDING",
        },
        transactionType: {
            type: String,
            enum: ["referral_bonus", "deposit", "withdrawal", "contest_entry", "contest_winnings", "refund"],
            required: true,
        },
        paymentMethod: {
            type: String, // e.g., 'bkash', 'nagad', 'card'
        },
        metadata: {
            type: Object, // Store extra details like bank info, transaction IDs from gateways
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = Transaction;
