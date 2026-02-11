const mongoose = require("mongoose");

const followUnfollowSchema = new mongoose.Schema(
    {
        follower: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        following: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

// Compound unique index to prevent duplicate follows
followUnfollowSchema.index({ follower: 1, following: 1 }, { unique: true });

const FollowUnfollow = mongoose.model("FollowUnfollow", followUnfollowSchema);

module.exports = FollowUnfollow;
