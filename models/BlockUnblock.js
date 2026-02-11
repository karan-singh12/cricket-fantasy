const mongoose = require("mongoose");

const blockUnblockSchema = new mongoose.Schema(
    {
        blocker: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        blocked: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

// Compound unique index to prevent duplicate blocks
blockUnblockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

const BlockUnblock = mongoose.model("BlockUnblock", blockUnblockSchema);

module.exports = BlockUnblock;
