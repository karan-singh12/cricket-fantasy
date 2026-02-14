const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
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
        title: {
            type: String,
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
            enum: ["SUCCESS", "FAILED", "PENDING", "CANCELLED", "INITIATED"],
            default: "PENDING",
        },
        transactionType: {
            type: String,
            enum: ["referral_bonus", "deposit", "withdrawal", "contest_entry", "contest_winnings", "refund", "withdraw", "credit", "debit", "contest_spend", "contest_winning"],
            required: true,
        },
        paymentMethod: {
            type: String, // e.g., 'bkash', 'nagad', 'card'
        },
        payment_id: { type: String },
        trx_id: { type: String },
        merchant_invoice_number: { type: String },
        contest: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Contest",
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
