const mongoose = require("mongoose");

const cmsSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            unique: true,
        },
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

// Transform to return numeric id and hide _id
cmsSchema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

cmsSchema.set("toObject", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

// Auto-increment numeric id
const Counter = require("./Counter");
cmsSchema.pre("save", async function () {
    if (!this.id) {
        const counter = await Counter.findByIdAndUpdate(
            { _id: "cmsId" },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        this.id = counter.seq;
    }
});

const Cms = mongoose.model("CMS", cmsSchema);

module.exports = Cms;
