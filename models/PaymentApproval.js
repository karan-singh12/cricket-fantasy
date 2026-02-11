const mongoose = require("mongoose");

const paymentApprovalSchema = new mongoose.Schema(
    {
        transaction: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Transaction",
            required: true,
        },
        type: {
            type: String,
            enum: ["DEPOSIT", "WITHDRAWAL"],
            required: true,
        },
        status: {
            type: String,
            enum: ["PENDING", "APPROVED", "REJECTED"],
            default: "PENDING",
        },
        payment_system: {
            type: String, // e.g., 'bkash', 'nagad', 'apay'
        },
        account_number: {
            type: String,
        },
        admin_notes: {
            type: String,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const PaymentApproval = mongoose.model("PaymentApproval", paymentApprovalSchema);

module.exports = PaymentApproval;
