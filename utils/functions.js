const nodemailer = require("nodemailer");
const fcmService = require("../services/fcmService");

const fs = require("fs/promises");
const axios = require("axios");
const path = require("path");
const sportmonksService = require("../services/sportmonksService");
const config = require("../config/config");
const { sendEmail } = require("./email");
const crypto = require("crypto");
async function slugGenrator(title) {
  let slug = title;

  // remove special characters
  slug = slug.replace(
    /\`|\~|\!|\@|\#|\||\$|\%|\^|\&|\*|\(|\)|\+|\=|\,|\.|\/|\?|\>|\<|\'|\"|\:|\;|_/gi,
    ""
  );
  // The /gi modifier is used to do a case insensitive search of all occurrences of a regular expression in a string

  // replace spaces with dash symbols
  slug = slug.replace(/ /gi, "-");

  // remove consecutive dash symbols
  slug = slug.replace(/\-\-\-\-\-/gi, "-");
  slug = slug.replace(/\-\-\-\-/gi, "-");
  slug = slug.replace(/\-\-\-/gi, "-");
  slug = slug.replace(/\-\-/gi, "-");

  // remove the unwanted dash symbols at the beginning and the end of the slug
  slug = "@" + slug + "@";
  slug = slug.replace(/\@\-|\-\@|\@/gi, "");

  return slug;
}

// List all data query
async function listing({
  baseQuery,
  selectFields = ["*"],
  sort = { column: "created_at", order: "desc" },
  pageNumber,
  pageSize,
}) {
  try {
    const offset = Math.max(0, (parseInt(pageNumber) - 1) * parseInt(pageSize));

    const totalRecords = await baseQuery.clone().count("* as count").first();

    const result = await baseQuery
      .clone()
      .select(selectFields)
      .orderBy(sort.column, sort.order)
      .limit(parseInt(pageSize))
      .offset(offset);

    return {
      result,
      totalRecords: parseInt(totalRecords.count),
      pageNumber: parseInt(pageNumber),
      pageSize: parseInt(pageSize),
    };
  } catch (error) {
    console.error("Listing Error:", error);
    throw new Error("Failed to list records");
  }
}

// const sendEmail = async (options) => {
//   return new Promise((resolve, reject) => {
//     let mailTransporter = nodemailer.createTransport({
//       host: process.env.HOST,
//       port: process.env.EMAIL_PORT,
//       service:"gmail",
//       auth: {
//         user: process.env.EMAIL,
//         pass: process.env.PASS,
//       },
//     });

//     // Send mail
//     const message = {
//       from: `Fantasy <${process.env.EMAIL}>`,
//       to: options.email,
//       subject: options.subject,
//       html: options.message,
//     };

//     mailTransporter
//       .sendMail(message)
//       .then(() => {
//         console.log("Email sent");
//         resolve(1);
//       })
//       .catch((error) => {
//         console.log("error",error);
//         resolve(0);
//       });
//   });
// };

function generateReferralCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let referralCode = "";
  for (let i = 0; i < 8; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    referralCode += chars[randomIndex];
  }
  return referralCode.toUpperCase();
}

// Helper function to delete file if it exists
const deleteFileIfExists = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
  
      return true;
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error);
      return false;
    }
  }
  return false;
};

function generateOtp() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function replaceTemplateVars(template, data) {
  return template.replace(/\{(\w+)\}/g, (match, key) => data[key] || "");
}

const sendSms = async ({ to, message }) => {
  if (!to || !message)
    throw new Error("Recipient number and message are required");

  const timestamp = Math.floor(Date.now() / 1000);
  const sign = crypto
    .createHash("md5")
    .update(`${config.laffic.api_key}${config.laffic.api_secret}${timestamp}`)
    .digest("hex");

  const orderId = Math.floor(Math.random() * 1000000);

  const body = {
    appId: config.laffic.appid,
    numbers: to,
    content: message,
    senderId: config.laffic.senderId,
    orderId: orderId.toString(),
  };

  try {
    const response = await axios.post(
      "https://api.laaffic.com/v3/sendSms",
      body,
      {
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          "Api-Key": config.laffic.api_key,
          Timestamp: timestamp,
          Sign: sign,
        },
        timeout: 5000,
      }
    );

    if (response.data.status === "0") {
      const msgId = response.data.array?.[0]?.msgId || "N/A";
   
      return msgId;
    } else {
      console.error(`Failed to send SMS: ${response.data.reason}`);
      throw new Error(`SMS send failed: ${response.data.reason}`);
    }
  } catch (err) {
    console.error("Error sending SMS:", err.message);
    throw err;
  }
};

async function sendOtpToUser({ email, phone, otp, subject, html }) {
  if (email) {
    try {
      await sendEmail({ to: email, subject, html });
      // console.log(`✅ OTP ${otp} sent via Email to: ${email}`);
    } catch (err) {
      console.error(`❌ Failed to send OTP via Email to ${email}:`, err.message);
      throw new Error("OTP sending failed via Email");
    }
  }

  if (phone) {
    const message = `Your OTP code is: ${otp}`;
    try {
      await sendSms({ to: phone, message });
      // console.log(`✅ OTP ${otp} sent via SMS to: ${phone}`);
    } catch (err) {
      console.error(`❌ Failed to send OTP via SMS to ${phone}:`, err.message);
      throw new Error("OTP sending failed via SMS");
    }
  }

  if (!email && !phone) {
    throw new Error("Either email or phone must be provided to send OTP");
  }
}


const downloadAndSaveImage = async (url, id, type) => {
  try {
    // Create directories based on type
    let dirPath;
    switch (type) {
      case "tournaments":
        dirPath = path.join(__dirname, "..", "public", "tournaments", "logo");
        break;
      case "players":
        dirPath = path.join(__dirname, "..", "public", "players");
        break;
      case "teams":
        dirPath = path.join(__dirname, "..", "public", "teams");
        break;
      case "venues":
        dirPath = path.join(__dirname, "..", "public", "venues");
        break;
      case "countries":
        dirPath = path.join(__dirname, "..", "public", "countries");
        break;
      default:
        dirPath = path.join(__dirname, "..", "public", type);
    }

    await fs.mkdir(dirPath, { recursive: true });

    // Download image
    console.log(`Attempting to download image from: ${url}`);
    let imageBuffer;
    try {
      const response = await axios({
        method: "get",
        url: url.trim(),
        responseType: "arraybuffer",
        timeout: 10000,
      });
      imageBuffer = response.data;
      console.log("Successfully downloaded image data");
    } catch (error) {
      console.error(`Error downloading image from ${url}:`, {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
      });
      throw error;
    }

    // Generate filename
    const ext = url.split(".").pop().split("?")[0]; // in case url has query params
    const filename = `${id}.${ext}`;
    const filePath = path.join(dirPath, filename);

    // Save file
    try {
      await fs.writeFile(filePath, imageBuffer);
      console.log(`Successfully saved image to: ${filePath}`);

      // Return relative path
      let relativePath;
      switch (type) {
        case "tournaments":
          relativePath = path.join("tournaments", "logo", filename);
          break;
        case "players":
          relativePath = path.join("players", filename);
          break;
        case "teams":
          relativePath = path.join("teams", filename);
          break;
        case "venues":
          relativePath = path.join("venues", filename);
          break;
        case "countries":
          relativePath = path.join("countries", filename);
          break;
        default:
          relativePath = path.join(type, filename);
      }

      console.log(`Image saved to relative path: ${relativePath}`);
      return relativePath;
    } catch (error) {
      console.error(`Error saving image to file: ${error.message}`);
      throw error;
    }
  } catch (error) {
    console.error(`Error downloading image: ${error.message}`);
    return null;
  }
};

async function sendPushNotificationFCM(ftoken, title, body, data = {}) {
  if (!ftoken) {
    console.error("❌ Device token is required");
    throw new Error("Device token is required");
  }

  const message = {
    token: ftoken,
    notification: {
      title: title,
      body: body,
    },
    data: data,
  };

  try {
    const response = await fcmService.messaging().send(message);
    // console.log("✅ Push sent:", response);
    return response;
  } catch (error) {
    if (error.code === "messaging/registration-token-not-registered") {
      console.warn("⚠️ Token is invalid.");
    }
    console.error("❌ FCM error:", error);
    throw error;
  }
}
async function generatePlayerStats(playerId, role) {
  try {
    const recentSeasons = await sportmonksService.getPlayerCareerStats(
      playerId
    );

    if (!recentSeasons.length) {
      return {
        credits: 7.0,
        avgFantasyPoints: 0,
        selectionPercent: 0,
        totalMatches: 0,
      };
    }

    const formatMultipliers = {
      T20I: 1.1,
      ODI: 1.0,
      "Test/5day": 0.9,
      T20: 0.8,
      "List A": 0.7,
    };
    const roleBenchmarks = {
      Batsman: 35,
      Bowler: 32,
      Allrounder: 40,
      Wicketkeeper: 30,
    };

    let totalMatches = 0;
    let totalFantasyPoints = 0;

    for (const season of recentSeasons) {
      const batting = season.batting || {};
      const bowling = season.bowling || {};
      const matches = batting.matches || bowling.matches || 0;
      if (matches === 0) continue;

      let seasonPoints = 0;

      // Batting points
      seasonPoints += batting.runs_scored || 0;
      seasonPoints += batting.four_x || 0;
      seasonPoints += (batting.six_x || 0) * 2;
      seasonPoints += (batting.hundreds || 0) * 16;
      seasonPoints += (batting.fifties || 0) * 8;

      // Bowling points
      if (bowling?.wickets != null) {
        seasonPoints += (bowling.wickets || 0) * 25;
        if (bowling.wickets >= 3) seasonPoints += 8;
        if (bowling.wickets >= 5) seasonPoints += 16;
      }

      // Apply format multiplier
      const multiplier = formatMultipliers[season.type] || 0.7;
      seasonPoints *= multiplier;

      totalMatches += matches;
      totalFantasyPoints += seasonPoints;
    }

    const avgFantasyPoints = totalMatches
      ? totalFantasyPoints / totalMatches
      : 0;

    const benchmark = roleBenchmarks[role] || 30;
    const performanceRatio = Math.min(2.0, avgFantasyPoints / benchmark);

    let credits = 7.0 + performanceRatio * 3.0;
    credits = Math.max(7.0, Math.min(credits, 11.0));

    const selectionPercent = Math.min(100, Math.round(avgFantasyPoints / 2));

    return {
      credits: parseFloat(credits.toFixed(1)),
      avgFantasyPoints: Math.round(avgFantasyPoints),
      selectionPercent,
      totalMatches,
    };
  } catch (error) {
    console.error(
      `Error generating stats for player ${playerId}:`,
      error.message
    );
    return {
      credits: 7.0,
      avgFantasyPoints: 0,
      selectionPercent: 0,
      totalMatches: 0,
    };
  }
}

module.exports = {
  slugGenrator,
  generatePlayerStats,
  generateReferralCode,
  listing,
  deleteFileIfExists,
  generateOtp,
  downloadAndSaveImage,
  replaceTemplateVars,
  sendOtpToUser,
  sendPushNotificationFCM,
};
