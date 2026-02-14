const mongoose = require("mongoose");
const connectDB = require("../config/mongoose");
const Admin = require("../models/Admin");
require("dotenv").config();

const addDefaultAdmin = async () => {
    try {
        await connectDB();

        const adminExists = await Admin.findOne({ email: "admin@admin.com" });

        if (adminExists) {
            console.log("Admin already exists!");
            process.exit(0);
        }

        const defaultAdmin = new Admin({
            name: "Super Admin",
            email: "admin@admin.com",
            password: "adminpassword", // Will be hashed by pre-save hook
            role: "superadmin",
            status: 1
        });

        await defaultAdmin.save();
        console.log("Default Admin created successfully!");
        console.log("Email: admin@admin.com");
        console.log("Password: adminpassword");

        process.exit(0);
    } catch (error) {
        console.error("Error adding default admin:", error);
        process.exit(1);
    }
};

addDefaultAdmin();
