const Admin = require("../../models/Admin");
const EmailTemplate = require("../../models/EmailTemplate");
const SocialLink = require("../../models/SocialLink");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const config = require("../../config/config");
const { sendEmail } = require("../../utils/email");

const generateRandomPassword = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#&";
  let password = "";
  for (let i = 0; i < 6; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Login function
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email, status: { $ne: 2 } });

    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }
    console.log(config.jwtSecret)

    const token = jwt.sign({ id: admin._id, role: "admin" }, config.jwtSecret, {
      expiresIn: "180d",
    });

    res.json({
      success: true, data: {
        token, admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Login failed", error: error.message });
  }
};

// Login1 function
const login1 = async (req, res) => {
  res.status(200).json({ success: true, message: "Successfully logged in" });
};

// Register function
const register = async (req, res) => {
  try {
    let name = 'admin';
    let email = 'admin@getnada.com';
    let password = 'Admin@123';

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "Email already in use",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = new Admin({
      name,
      email,
      password: hashedPassword,
    });

    await newAdmin.save();

    res.status(201).json({
      success: true,
      message: "Admin registered successfully",
      data: {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
    });
  }
};

// Logout function
const logout = async (req, res) => {
  try {
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Logout failed", error: error.message });
  }
};

// Get profile function
const getProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id).select("id name email created_at");

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    res.json({
      success: true,
      data: admin,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: error.message,
    });
  }
};

// Update profile function
const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;

    if (email) {
      const existingAdmin = await Admin.findOne({ email, _id: { $ne: req.user.id } });
      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          message: "Email already in use",
        });
      }
    }

    const admin = await Admin.findByIdAndUpdate(
      req.user.id,
      { name, email },
      { new: true }
    ).select("id name email");

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: admin,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message,
    });
  }
};

// Change password function
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const admin = await Admin.findById(req.user.id);

    if (!(await bcrypt.compare(currentPassword, admin.password))) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedPassword;
    await admin.save();

    res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update password", error: error.message });
  }
};

const updateSocialLinks = async (req, res) => {
  try {
    const { telegram, whatsapp, facebook, instagram, x, email, address, mode, credit } = req.body;

    let socialLinks = await SocialLink.findOne();

    if (socialLinks) {
      socialLinks.telegram = telegram;
      socialLinks.whatsapp = whatsapp;
      socialLinks.facebook = facebook;
      socialLinks.instagram = instagram;
      socialLinks.x = x;
      socialLinks.mode = mode;
      socialLinks.email = email;
      socialLinks.address = address;
      socialLinks.credit_limit = credit;
      await socialLinks.save();
    } else {
      socialLinks = new SocialLink({
        telegram, whatsapp, facebook, instagram, x, mode, email, address, credit_limit: credit
      });
      await socialLinks.save();
    }

    res.json({ success: true, message: "Social links updated successfully", data: socialLinks });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update social links", error: error.message });
  }
};

const getSocialLinks = async (req, res) => {
  try {
    const socialLinks = await SocialLink.findOne();
    res.json({ success: true, data: socialLinks || {} });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch social links", error: error.message });
  }
};

const forgotpassword = async (req, res) => {
  try {
    const { email } = req.body;
    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin with this email not found" });
    }

    const newPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    admin.password = hashedPassword;
    await admin.save();

    const templateResult = await EmailTemplate.findOne({
      slug: "send-password-admin",
      status: 1,
    });

    if (templateResult) {
      let content = templateResult.content;
      content = content.replace(/{name}/g, admin.name);
      content = content.replace(/{password}/g, newPassword);

      const options = {
        to: admin.email,
        subject: templateResult.subject,
        html: content,
      };

      sendEmail(options);
    }

    res.json({
      success: true,
      message: "Password reset successfully",
      data: {
        message: "A new password has been generated. Check your email.",
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Password reset failed", error: error.message });
  }
};

module.exports = {
  login,
  login1,
  forgotpassword,
  register,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  updateSocialLinks,
  getSocialLinks,
};
