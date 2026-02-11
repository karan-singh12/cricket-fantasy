const mongoose = require("mongoose");

const cmsSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        contentType: {
            type: String,
            required: true,
            index: true,
            unique: true,
        },
        description: {
            type: String,
        },
        image_path: {
            type: String,
        },
        meta_title: {
            type: String,
        },
        meta_description: {
            type: String,
        },
        status: {
            type: Number, // 1: Active, 0: Inactive, 2: Deleted
            default: 1,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

const Cms = mongoose.model("CMS", cmsSchema);

module.exports = Cms;
