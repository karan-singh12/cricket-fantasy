const mongoose = require("mongoose");

const appDownloadSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            unique: true,
        },
        file_name: {
            type: String,
            required: true,
        },
        file_path: {
            type: String,
            required: true,
        },
        current_version: {
            type: String,
            required: true,
        },
        previous_version: {
            type: String,
            required: true,
        },
        platform: {
            type: String,
            enum: ["android", "ios", "unknown"],
            default: "unknown",
        },
        ios_app_store_link: {
            type: String,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

// Transform to return numeric id and hide _id
appDownloadSchema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

appDownloadSchema.set("toObject", {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        return ret;
    },
});

// Auto-increment numeric id
const Counter = require("./Counter");
appDownloadSchema.pre("save", async function () {
    if (!this.id) {
        const counter = await Counter.findByIdAndUpdate(
            { _id: "appDownloadId" },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        this.id = counter.seq;
    }
});

const AppDownload = mongoose.model("AppDownload", appDownloadSchema);

module.exports = AppDownload;
