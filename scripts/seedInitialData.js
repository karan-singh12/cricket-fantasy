const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("../config/mongoose");
const User = require("../models/User");
const Admin = require("../models/Admin");
const Wallet = require("../models/Wallet");

async function seed() {
    try {
        await connectDB();
        console.log("🚀 Starting seeding...");

        // 1. Create Admin
        const adminEmail = "admin@mybest11.com";
        let admin = await Admin.findOne({ email: adminEmail });
        if (!admin) {
            admin = await Admin.create({
                name: "Super Admin",
                email: adminEmail,
                password: "adminpassword", // Will be hashed by pre-save hook
                role: "admin",
                status: 1,
                phoneNumber: "1234567890",
            });
            console.log("✅ Admin created: " + adminEmail);
        } else {
            console.log("ℹ️ Admin already exists");
        }

        // 2. Create Regular User
        const userEmail = "user@example.com";
        let user = await User.findOne({ email: userEmail });
        if (!user) {
            user = await User.create({
                name: "Test User",
                email: userEmail,
                phone: "01700000000",
                password: "userpassword", // Will be hashed by pre-save hook
                role: "user",
                status: 1,
                is_verified: true,
                wallet_balance: 1000,
            });
            console.log("✅ User created: " + userEmail);

            // Create Wallet for user
            await Wallet.create({
                user: user._id,
                balance: 1000,
                currency: "BDT"
            });
            console.log("✅ Wallet created for user");
        } else {
            console.log("ℹ️ User already exists");
        }

        console.log("✨ Seeding completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    }
}

seed();
