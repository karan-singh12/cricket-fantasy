const { knex: db } = require("../../config/database");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const config = require("../../config/config");
const { sendEmail } = require("../../utils/email");
const moment = require("moment");
const apiResponse = require("../../utils/apiResponse");
const {
  slugGenrator,
  listing,
  generateReferralCode,
  generateOtp,
  sendOtpToUser,
  sendPushNotificationFCM,
} = require("../../utils/functions");
const {
  ERROR,
  USER,
  SUCCESS,
  NOTIFICATION,
} = require("../../utils/responseMsg");
const { getLanguage } = require("../../utils/responseMsg");
const { translateTo } = require("../../utils/google");

async function translateNotificationText(text, targetLang) {
  if (!targetLang) {
    const lang = getLanguage();
    targetLang = lang ? lang.toLowerCase() : "en";
    if (targetLang === "hn") targetLang = "hi";
  }
  return await translateTo(text, targetLang);
}

async function translateNotificationData(notification) {
  const lang =
    getLanguage().toLowerCase() === "hn" ? "hi" : getLanguage().toLowerCase();

  return {
    ...notification,
    title: await translateNotificationText(notification.title, lang),
    content: await translateNotificationText(notification.content, lang),
  };
}

async function getReferralSettings() {
  const settings = await db("referral_settings").first();
  if (!settings) {
    return {
      is_active: false, // or throw error
      referrer_bonus: null,
      referee_bonus: null,
      max_referrals_per_user: 0,
      min_referee_verification: true,
      bonus_currency: "BDT",
    };
  }
  return settings;
}

async function processReferralBonus(trx, referrer, referee) {
  try {
    // Ensure admin assigned bonus
    if (!referrer || !referee || !referrer.referral_bonus) {
      console.log("Referral inactive: missing referrer/referee/bonus");
      return;
    }

    const referrerBonus = parseFloat(referrer.referral_bonus);
    const refereeBonus = parseFloat(referrer.referral_bonus);
    const currency = "BDT";

    // --- Referrer Wallet ---
    let referrerWallet = await trx("wallet")
      .where("user_id", referrer.id)
      .first();
    if (!referrerWallet) {
      await trx("wallet").insert({
        user_id: referrer.id,
        balance: 0.0,
        currency,
        created_at: trx.fn.now(),
        updated_at: trx.fn.now(),
      });
      referrerWallet = { balance: 0 };
    }
    const newRefBalance = parseFloat(referrerWallet.balance) + referrerBonus;
    await trx("wallet")
      .where("user_id", referrer.id)
      .update({ balance: newRefBalance.toFixed(2), updated_at: trx.fn.now() });
    await trx("users")
      .where("id", referrer.id)
      .update({
        wallet_balance: newRefBalance.toFixed(2),
        updated_at: trx.fn.now(),
      });
    await trx("transactions").insert({
      user_id: referrer.id,
      title: "referral_bonus",
      amount: referrerBonus,
      currency,
      status: "SUCCESS",
      transactionType: "referral_bonus",
      created_at: trx.fn.now(),
      updated_at: trx.fn.now(),
    });

    // --- Referee Wallet ---
    let refereeWallet = await trx("wallet")
      .where("user_id", referee.id)
      .first();
    if (!refereeWallet) {
      await trx("wallet").insert({
        user_id: referee.id,
        balance: 0.0,
        currency,
        created_at: trx.fn.now(),
        updated_at: trx.fn.now(),
      });
      refereeWallet = { balance: 0 };
    }
    const newRefereeBalance = parseFloat(refereeWallet.balance) + refereeBonus;
    await trx("wallet")
      .where("user_id", referee.id)
      .update({
        balance: newRefereeBalance.toFixed(2),
        updated_at: trx.fn.now(),
      });
    await trx("users")
      .where("id", referee.id)
      .update({
        wallet_balance: newRefereeBalance.toFixed(2),
        referred_by: referrer.id,
        updated_at: trx.fn.now(),
      });
    await trx("transactions").insert({
      user_id: referee.id,
      title: "referral_bonus",
      amount: refereeBonus,
      currency,
      status: "SUCCESS",
      transactionType: "referral_bonus",
      created_at: trx.fn.now(),
      updated_at: trx.fn.now(),
    });

    // Referrer Notification
    const referrerTemplate = await trx("notification_templates")
      .where({ slug: "Referral-Code-Used", status: 1 })
      .first();

    if (referrerTemplate) {
      const title = referrerTemplate.title || "Referral Code Used!";
      const content = (referrerTemplate.content || "").replace(
        "{{referee_email}}",
        referee.email || "a new user"
      );

      await trx("notifications").insert({
        user_id: referrer.id,
        title,
        content,
        is_read: false,
        sent_at: trx.fn.now(),
        created_at: trx.fn.now(),
      });
    }

    // Referee Notification
    const refereeTemplate = await trx("notification_templates")
      .where({ slug: "Referral-Bonus-Received", status: 1 })
      .first();

    if (refereeTemplate) {
      const title = refereeTemplate.title || "Referral Bonus Received!";
      const content = (refereeTemplate.content || "")
        .replace("{{bonusAmount}}", refereeBonus.toFixed(2))
        .replace("{{currency}}", currency);

      await trx("notifications").insert({
        user_id: referee.id,
        title,
        content,
        is_read: false,
        sent_at: trx.fn.now(),
        created_at: trx.fn.now(),
      });
    }
  } catch (error) {
    console.error("Error in processReferralBonus:", error);
    throw error;
  }
}

const userAuthController = {
  async login(req, res) {
    try {
      let { email, phone, ftoken } = req.body;

      if (!email && !phone) {
        return apiResponse.ErrorResponse(res, ERROR.EmailPhoneisRequired);
      }

      email = email?.trim().toLowerCase();
      const isEmailLogin = !!email;
      const otp = "1234"; // Static OTP for testing
      const condition = isEmailLogin ? db.raw("LOWER(email) = ?", [email]) : { phone };

      let user = await db("users")
        .where(condition)
        .andWhere("status", 1)
        .first();

      if (!user) {
        const inactiveUser = await db("users")
          .where(condition)
          .andWhere("status", 0)
          .first();

        if (inactiveUser) {
          return apiResponse.ErrorResponse(
            res,
            "This account is inactive by admin, please contact to admin"
          );
        }

        //   if (deletedUser) {
        //     return apiResponse.ErrorResponse(res,
        //   "This account has already deleted please create account again.",
        // );
        //   }
        const insertData = {
          // referral_code: generateReferralCode(),
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
          status: 1,
          ...(email && { email }),
          ...(phone && { phone }),
          ...(ftoken && { ftoken }),
        };

        [user] = await db("users").insert(insertData).returning("*");
      } else {
        const updateFields = {
          updated_at: db.fn.now(),
        };
        if (ftoken !== undefined && ftoken !== null && ftoken.trim() !== "") {
          updateFields.ftoken = ftoken;
        }

        // if (!user.referral_code) {
        //   updateFields.referral_code = generateReferralCode();
        // }

        await db("users").where({ id: user.id }).update(updateFields);
        user = await db("users").where({ id: user.id }).first();
      }

      const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
      await db("users").where({ id: user.id }).update({
        otp,
        otp_expires: otpExpires,
        updated_at: db.fn.now(),
      });

      // if (isEmailLogin) {
      //   const template = await db("emailtemplates")
      //     .where({ slug: "Send-OTP", status: 1 })
      //     .select("subject", "content")
      //     .first();

      //   const subject = template?.subject || "Your One-Time Password (OTP)";
      //   const html = template
      //     ? require("../../utils/functions").replaceTemplateVars(
      //         template.content,
      //         { email, otp }
      //       )
      //     : `<p>Your One-Time Password (OTP) is: <strong>${otp}</strong></p>`;

      //   await sendOtpToUser({ email, otp, subject, html });
      // } else {
      //   await sendOtpToUser({ phone, otp });
      // }

      return apiResponse.successResponseWithData(
        res,
        isEmailLogin ? USER.otpSentEmail : USER.otpSentNumber,
        { otp }
      );
    } catch (error) {
      console.error("Login error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
  async socialLogin(req, res) {
    try {
      const {
        email,
        name,
        socialLoginType,
        deviceId,
        deviceType,
        googleId,
        invite_code,
        ftoken,
      } = req.body;
      if (!email || !googleId || !socialLoginType) {
        return apiResponse.ErrorResponse(
          res,
          USER.emailGoogleIdSocialLoginTypeRequired
        );
      }

      let user = await db("users")
        .where(function () {
          this.where("email", email);
        })
        .first();

      let isNewUser = false;
      if (!user || user.status === 2) {
        // const referral_code = generateReferralCode();
        [user] = await db("users")
          .insert({
            email,
            name,
            google_id: googleId,
            social_login_type: socialLoginType,
            device_id: deviceId,
            device_type: deviceType,
            ftoken: ftoken || null,
            is_name_setup: !!name,
            is_verified: true,
            // referral_code,
            status: 1,
            created_at: db.fn.now(),
            updated_at: db.fn.now(),
          })
          .returning("*");
        isNewUser = true;
      } else {
        let updateData = {
          google_id: googleId,
          social_login_type: socialLoginType,
          device_id: deviceId,
          device_type: deviceType,
          is_name_setup: !!name,
          updated_at: db.fn.now(),
        };
        if (ftoken) {
          updateData.ftoken = ftoken;
        }
        // if (!user.referral_code) {
        //   updateData.referral_code = generateReferralCode();
        // }
        await db("users").where({ id: user.id }).update(updateData);
        user = await db("users").where({ id: user.id }).first();
      }

      let userWallet = await db("wallet").where("user_id", user.id).first();
      if (!userWallet) {
        await db("wallet").insert({
          user_id: user.id,
          balance: 0.0,
          currency: "BDT",
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        });
        userWallet = { balance: 0 };
      }

      if (invite_code && !user.referred_by) {
        const referrer = await db("users")
          .where("referral_code", invite_code)
          .first();
        if (!referrer) {
          return apiResponse.ErrorResponse(res, USER.invalidInviteCode);
        }

        if (!referrer.referral_bonus) {
          return apiResponse.ErrorResponse(
            res,
            "This referral code is inactive. Please use a valid one."
          );
        }

        await db.transaction(async (trx) => {
          await processReferralBonus(trx, referrer, user);
        });

        user = await db("users").where({ id: user.id }).first();
      }

      const token = jwt.sign({ id: user.id, role: "user" }, config.jwtSecret, {
        expiresIn: "180d"
      });

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
        token,
        user,
      });
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async updateFtoken(req, res) {
    try {
      const userId = req.user.id;
      const { ftoken } = req.body;

      if (!ftoken || ftoken.trim() === "") {
        return apiResponse.ErrorResponse(res, "ftoken is required");
      }

      await db("users").where({ id: userId }).update({
        ftoken: ftoken.trim(),
        updated_at: db.fn.now(),
      });

      return apiResponse.successResponse(
        res,
        "Device token updated successfully"
      );
    } catch (error) {
      console.error("Error updating ftoken:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async verifyOtp(req, res) {
    try {
      let { email, phone, otp, invite_code } = req.body;

      if ((!email && !phone) || !otp) {
        return apiResponse.ErrorResponse(res, ERROR.EmailPhoneOTPisRequired);
      }

      let data;
      if (email) {
        email = email.trim().toLowerCase();
        data = await db("users")
          .whereRaw("LOWER(email) = ?", [email])
          .andWhere("status", 1)
          .first();
      } else {
        data = await db("users").where({ phone }).andWhere("status", 1).first();
      }

      if (!data) return apiResponse.ErrorResponse(res, USER.accountNotExists);
      if (data.otp !== otp)
        return apiResponse.ErrorResponse(res, USER.otpNotMatched);

      const now = new Date();
      if (!data.otp_expires || new Date(data.otp_expires) < now) {
        return apiResponse.ErrorResponse(res, USER.otpExpired);
      }

      if (invite_code && data.referred_by) {
        return apiResponse.ErrorResponse(res, USER.alreadyUsedInviteCode);
      }

      let referrer = null;
      if (invite_code) {
        referrer = await db("users")
          .where("referral_code", invite_code)
          .first();

        if (!referrer) {
          return apiResponse.ErrorResponse(res, USER.invalidInviteCode);
        }

        if (!referrer.referral_code || !referrer.referral_bonus) {
          return apiResponse.ErrorResponse(
            res,
            "This referral code is inactive. Please use a valid one."
          );
        }

        if (data.referred_by) {
          return apiResponse.ErrorResponse(res, USER.alreadyUsedInviteCode);
        }
      }

      const verifiedUser = await db.transaction(async (trx) => {
        await trx("users").where("id", data.id).update({
          is_verified: true,
          otp: null,
          otp_expires: null,
          updated_at: trx.fn.now(),
        });
        const updatedUser = await trx("users").where("id", data.id).first();

        let userWallet = await trx("wallet").where("user_id", data.id).first();
        if (!userWallet) {
          await trx("wallet").insert({
            user_id: data.id,
            balance: 0.0,
            currency: "BDT",
            created_at: trx.fn.now(),
            updated_at: trx.fn.now(),
          });
          userWallet = { balance: 0 };
        }

        if (referrer && !data.referred_by) {
          const settings = await getReferralSettings();

          // 🚫 require referral_bonus to be set
          if (!referrer.referral_bonus) {
            throw new Error(
              "Referral bonus not set for this referral code. Contact admin."
            );
          }

          // Override with Admin-defined bonus
          settings.referrer_bonus = referrer.referral_bonus;
          settings.referee_bonus = referrer.referral_bonus;

          await processReferralBonus(trx, referrer, updatedUser, settings);
        }

        return await trx("users").where("id", data.id).first();
      });

      if (referrer && referrer.ftoken) {
        try {
          await sendPushNotificationFCM(
            referrer.ftoken,
            "Referral Bonus",
            `Your referral code was used by ${data.email || data.phone
            }. You've earned a bonus!`
          );
        } catch (pushError) {
          console.error("FCM push failed:", pushError);
        }
      }
      if (verifiedUser.ftoken) {
        try {
          await sendPushNotificationFCM(
            verifiedUser.ftoken,
            "Referral Bonus",
            `You used a referral code and received a bonus! Welcome aboard.`
          );
        } catch (pushError) {
          console.error("FCM push failed for referee:", pushError);
        }
      }

      const token = jwt.sign(
        { id: verifiedUser.id, role: "user" },
        config.jwtSecret,
        { expiresIn: "180d" } // 6 months
      );

      return apiResponse.successResponseWithData(res, USER.otpVerified, {
        token,
        user: verifiedUser,
      });
    } catch (error) {
      console.error("OTP verification error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      const user = await db("users").where("id", req.user.id).first();

      if (!user || !user.password) {
        return res.status(400).json({ error: USER.userOrPasswordNotFound });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: USER.currentPasswordIncorrect });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await db("users").where("id", req.user.id).update({
        password: hashedPassword,
        updated_at: db.fn.now(),
      });

      res.json({ message: USER.passwordUpdatedSuccessfully });
    } catch (error) {
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async contactUs(req, res) {
    try {
      const { message, type, name, email, from } = req.body;

      if (!message) {
        return apiResponse.ErrorResponse(res, ERROR.messageRequired);
      }
      if (from === "Website") {
        if (!name) {
          return apiResponse.ErrorResponse(res, "Name is Required.");
        }
        if (!email) {
          return apiResponse.ErrorResponse(res, "Email is Required.");
        }
        if (!type) {
          return apiResponse.ErrorResponse(res, "Type is Required");
        }
        if (!message) {
          return apiResponse.ErrorResponse(res, "Message is Required");
        }
      }

      await db("support").insert({
        user_id: req?.user?.id || null,
        message,
        name,
        email,
        from,
        type,
        status: 1,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      });
      const template = await db("emailtemplates")
        .where({ slug: "send-query-admin", status: 1 })
        .first();

      if (template) {
        const socialLink = await db("social_links").first();
        const adminEmail = socialLink?.email;

        if (adminEmail) {
          const htmlContent = template.content
            .replace("{{name}}", name)
            .replace("{{email}}", email)
            .replace("{{type}}", type)
            .replace("{{message}}", message);

          await sendOtpToUser({
            email: adminEmail,
            subject: template.subject || "New Contact Us Submission",
            html: htmlContent,
          });
        }
      }

      return apiResponse.successResponseWithData(res, USER.contactUsSubmitted);
    } catch (error) {
      console.error("Contact us error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      const user = await db("users").where("email", email).first();

      if (!user) {
        return res.status(404).json({ error: USER.accountNotExists });
      }

      const resetToken = jwt.sign({ id: user.id }, config.jwtSecret, {
        expiresIn: "1h",
      });

      await db("users")
        .where("id", user.id)
        .update({
          reset_password_token: resetToken,
          reset_password_expires: new Date(Date.now() + 3600000),
          updated_at: db.fn.now(),
        });

      const templateResult = await knex("emailtemplates")
        .select("content", "subject")
        .where({
          slug: "user-forgot-password",
          status: 1,
        })
        .first();

      if (templateResult) {
        let content = templateResult.content;

        // placeholders replace करो
        content = content.replace(/{{name}}/g, user.name);
        content = content.replace(
          /{{resetLink}}/g,
          `${config.appUrl}/reset-password/${resetToken}`
        );

        const options = {
          to: user.email,
          subject: templateResult.subject,
          html: content,
        };

        await sendEmail(options);
      }

      res.json({ message: USER.otpReSentEmail });
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;

      const user = await db("users")
        .where("reset_password_token", token)
        .where("reset_password_expires", ">", new Date())
        .first();

      if (!user) {
        return res.status(400).json({ error: USER.invalidOrExpireToken });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await db("users").where("id", user.id).update({
        password: hashedPassword,
        reset_password_token: null,
        reset_password_expires: null,
        updated_at: db.fn.now(),
      });

      res.json({ message: USER.passwordResetSuccessfully });
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
  // non login user resend otp
  async resendOtp(req, res) {
    try {
      const { email, phone } = req.body;

      if (!email && !phone) {
        return apiResponse.ErrorResponse(res, USER.emailOrPhoneRequired);
      }

      const normalizedEmail = email?.trim().toLowerCase();
      const isEmailRequest = !!normalizedEmail;

      const condition = isEmailRequest
        ? db.raw("LOWER(email) = ?", [normalizedEmail])
        : { phone };

      const user = await db("users").where(condition).first();

      if (!user) {
        return apiResponse.ErrorResponse(res, USER.accountNotExists);
      }

      const newOtp = isEmailRequest ? generateOtp() : "1234";
      const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await db("users").where({ id: user.id }).update({
        otp: newOtp,
        otp_expires: otpExpires,
        updated_at: db.fn.now(),
      });

      if (isEmailRequest) {
        const template = await db("emailtemplates")
          .where({ slug: "Send-OTP", status: 1 })
          .select("subject", "content")
          .first();

        const subject = template?.subject || "Your One-Time Password (OTP)";
        const html = template
          ? require("../../utils/functions").replaceTemplateVars(
            template.content,
            {
              email: normalizedEmail,
              otp: newOtp,
            }
          )
          : `<p>Your One-Time Password (OTP) is: <strong>${newOtp}</strong></p>`;

        await sendOtpToUser({
          email: normalizedEmail,
          otp: newOtp,
          subject,
          html,
        });
      } else {
        await sendOtpToUser({ phone, otp: newOtp });
      }

      return apiResponse.successResponseWithData(
        res,
        "OTP resend successfully",
        {
          otp: newOtp,
        }
      );
    } catch (error) {
      console.error("Resend OTP error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
  // login user resend otp
  async resendAuthOtp(req, res) {
    try {
      const { email, phone } = req.body;

      if (!email && !phone) {
        return apiResponse.ErrorResponse(res, ERROR.EmailPhoneisRequired);
      }

      const normalizedEmail = email?.trim().toLowerCase();
      const isEmail = !!normalizedEmail;

      const newOtp = isEmail ? generateOtp() : generateOtp();
      const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      const [updatedUser] = await db("users")
        .where("id", req.user.id)
        .update({
          otp: newOtp,
          otp_expires: otpExpires,
          updated_at: db.fn.now(),
        })
        .returning("*");

      if (isEmail) {
        const template = await db("emailtemplates")
          .where({ slug: "Send-OTP", status: 1 })
          .select("subject", "content")
          .first();

        const subject = template?.subject || "Your One-Time Password (OTP)";
        const html = template
          ? require("../../utils/functions").replaceTemplateVars(
            template.content,
            {
              email: normalizedEmail,
              otp: newOtp,
            }
          )
          : `<p>Your One-Time Password (OTP) is: <strong>${newOtp}</strong></p>`;

        await sendOtpToUser({
          email: normalizedEmail,
          otp: newOtp,
          subject,
          html,
        });
      } else {
        await sendOtpToUser({ phone, otp: newOtp });
      }

      return apiResponse.successResponseWithData(
        res,
        email ? USER.otpReSentEmail : USER.otpReSentNumber,
        {
          otp: newOtp,
        }
      );
    } catch (error) {
      console.error("Resend Auth OTP error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getProfile(req, res) {
    try {
      const user = await db("users")
        .where("id", req.user.id)
        .select("*")
        .first();

      if (!user) {
        return apiResponse.ErrorResponse(res, USER.accountNotExists);
      }

      const [followersCount, followingCount] = await Promise.all([
        db("follow_unfollow")
          .where("following_id", req.user.id)
          .count("* as count")
          .first(),
        db("follow_unfollow")
          .where("follower_id", req.user.id)
          .count("* as count")
          .first(),
      ]);

      user.followers_count = parseInt(followersCount.count) || 0;
      user.following_count = parseInt(followingCount.count) || 0;

      const [followersList, followingList] = await Promise.all([
        db("follow_unfollow")
          .where("following_id", req.user.id)
          .select("following_id"),

        db("follow_unfollow")
          .where("follower_id", req.user.id)
          .select("follower_id"),
      ]);

      user.followers_list = followersList || [];
      user.following_list = followingList || [];

      const contestsResult = await db("fantasy_games")
        .where("user_id", req.user.id)
        .countDistinct("contest_id as count")
        .first();
      const contestsCount = parseInt(contestsResult.count) || 0;

      const matchesResult = await db("fantasy_teams")
        .where("user_id", req.user.id)
        .countDistinct("match_id as count")
        .first();
      const matchesCount = parseInt(matchesResult.count) || 0;

      const seriesResult = await db("fantasy_teams as ft")
        .join("matches as m", "ft.match_id", "m.id")
        .where("ft.user_id", req.user.id)
        .countDistinct("m.tournament_id as count")
        .first();
      const seriesCount = parseInt(seriesResult.count) || 0;

      const winningsResult = await db("fantasy_games as fg")
        .join("contests as c", "fg.contest_id", "c.id")
        .where("fg.user_id", req.user.id)
        .where("fg.rank", ">", 0)
        .select(
          db.raw("COUNT(*) as contests_won"),
          db.raw(`
            SUM(
              CASE 
                WHEN fg.rank = 1 AND c.winnings IS NOT NULL THEN 
                  (c.winnings->>'1')::numeric 
                WHEN fg.rank = 2 AND c.winnings IS NOT NULL THEN 
                  (c.winnings->>'2')::numeric
                WHEN fg.rank = 3 AND c.winnings IS NOT NULL THEN 
                  (c.winnings->>'3')::numeric
                ELSE 0 
              END
            ) as total_winnings
          `)
        )
        .first();

      const pointsResult = await db("fantasy_teams")
        .where("user_id", req.user.id)
        .sum("total_points as total_points")
        .first();

      const bestRankResult = await db("fantasy_games")
        .where("user_id", req.user.id)
        .whereNotNull("rank")
        .min("rank as best_rank")
        .first();
      const referralBonusResult = await db("transactions")
        .where("user_id", req.user.id)
        .andWhere("transactionType", "referral_bonus")
        .sum("amount as total_referral_bonus")
        .first();

      const winPercentage =
        contestsCount > 0
          ? Math.round((winningsResult.contests_won / contestsCount) * 100)
          : 0;

      user.careerStats = {
        contests: {
          total: contestsCount,
          won: parseInt(winningsResult.contests_won) || 0,
          winPercentage: winPercentage,
          totalWinnings: parseFloat(winningsResult.total_winnings) || 0,
        },
        matches: {
          total: matchesCount,
          totalPoints: parseFloat(pointsResult.total_points) || 0,
          bestRank: parseInt(bestRankResult.best_rank) || null,
        },
        series: {
          total: seriesCount,
        },
      };
      user.referralBonus =
        parseFloat(referralBonusResult.total_referral_bonus) || 0;

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, user);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async updateProfile(req, res) {
    try {
      const { name, email, dob, phone, gender } = req.body;
      const updateData = { updated_at: db.fn.now() };
      const userid = req.user.id;
      const updatedFields = [];

      const currentUser = await db("users").where({ id: userid }).first();

      if (!currentUser) {
        return res.status(404).json({
          error: "User not found",
        });
      }
      if (currentUser.status !== 1) {
        return res.status(400).json({
          error: "Only active accounts can update profile",
        });
      }
      if (email) {
        const normalizedEmail = email.trim().toLowerCase();

        // Only check uniqueness if email is different from current user's email
        if (normalizedEmail !== req.user.email.toLowerCase().trim()) {
          const existingUserWithEmail = await db("users")
            .where({ email: normalizedEmail })
            .whereNot("id", userid)
            .first(); // Check across ALL statuses

          if (existingUserWithEmail) {
            return res.status(400).json({
              error: ERROR.emailAlreadyInUse,
            });
          }
          updateData.email = normalizedEmail;
          updatedFields.push("email");
        } else {
          console.log(
            `Email ${normalizedEmail} is the same as current user's email, skipping update`
          );
        }
      }

      // Check phone uniqueness if provided
      if (phone && phone !== currentUser.phone) {
        const existingUserWithPhone = await db("users")
          .where({ phone })
          .whereNot("id", userid)
          .first(); // Check across ALL statuses

        if (existingUserWithPhone) {
          return res.status(400).json({
            error: ERROR.phoneAlreadyInUse,
          });
        }
        updateData.phone = phone;
        updatedFields.push("phone number");
      }

      if (name !== undefined) {
        updateData.name = name.trim().replace(/\s+/g, " ");
        updateData.is_name_setup = true;
        updatedFields.push("name");
      }
      if (dob !== undefined) {
        updateData.dob = dob;
        updatedFields.push("date of birth");
      }
      if (gender !== undefined) {
        updateData.gender = gender;
        updatedFields.push("gender");
      }
      if (req.file) {
        updateData.image_url = req.file.path.replace(/\\/g, "/");
        updatedFields.push("profile picture");
      }

      // Check if there are fields to update
      if (Object.keys(updateData).length <= 1) {
        return apiResponse.ErrorResponse(res, ERROR.noFieldsToUpdate);
      }

      // Update the user
      const [user] = await db("users")
        .where({ id: userid, status: 1 })
        .update(updateData)
        .returning("*");

      if (!user) {
        return res.status(400).json({
          error: "No active user found with the provided ID",
        });
      }

      // Generate notification
      let notificationTitle = "Profile Updated";
      let notificationContent = "Your profile has been successfully updated.";

      if (email || phone) {
        notificationTitle =
          email && phone
            ? "Email and Phone Update Verification"
            : email
              ? "Email Update Verification"
              : "Phone Update Verification";
        notificationContent = `Please verify your ${email && phone ? "email and phone" : email ? "email" : "phone"
          } with the OTP sent.`;
      } else if (updatedFields.length === 1) {
        const field = updatedFields[0];
        notificationTitle = `${field.charAt(0).toUpperCase() + field.slice(1)
          } Updated`;
        notificationContent = `Your ${field} has been successfully updated.`;
      } else if (updatedFields.length > 1) {
        const lastField = updatedFields.pop();
        const fieldsList = updatedFields.length
          ? `${updatedFields.join(", ")} and ${lastField}`
          : lastField;
        notificationTitle = "Profile Information Updated";
        notificationContent = `Your ${fieldsList} have been successfully updated.`;
      }

      await db("notifications").insert({
        user_id: userid,
        title: notificationTitle,
        content: notificationContent,
        is_read: false,
        sent_at: db.fn.now(),
        created_at: db.fn.now(),
      });

      return apiResponse.successResponseWithData(res, notificationTitle, user);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async updateEmail(req, res) {
    try {
      const { email, phone } = req.body;
      console.log("Request Body:", req.body);

      if (!email && !phone) {
        return apiResponse.ErrorResponse(res, USER.emailOrPhoneRequired);
      }

      const normalizedEmail = email?.trim().toLowerCase();
      const isEmailUpdate = !!normalizedEmail;
      const isPhoneUpdate = !!phone;

      const currentUser = await db("users").where({ id: req.user.id }).first();

      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (currentUser.status !== 1) {
        return res.status(400).json({
          error: "Only active accounts can update email or phone",
        });
      }

      // Duplicate checks
      if (isEmailUpdate && normalizedEmail !== currentUser.email) {
        const existingUserWithEmail = await db("users")
          .where({ email: normalizedEmail })
          .whereNot("id", req.user.id)
          .first();
        if (existingUserWithEmail) {
          return res.status(400).json({ error: ERROR.emailAlreadyInUse });
        }
      }

      if (isPhoneUpdate && phone !== currentUser.phone) {
        const existingUserWithPhone = await db("users")
          .where({ phone })
          .whereNot("id", req.user.id)
          .first();
        if (existingUserWithPhone) {
          return res.status(400).json({ error: ERROR.phoneAlreadyInUse });
        }
      }

      // Generate OTP
      const otp = generateOtp();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Prepare update data
      const updateData = {
        otp,
        otp_expires: otpExpires,
        updated_at: db.fn.now(),
      };
      if (isEmailUpdate) updateData.email = normalizedEmail;
      if (isPhoneUpdate) updateData.phone = phone;

      // Update user
      const [updatedUser] = await db("users")
        .where({ id: req.user.id, status: 1 })
        .update(updateData)
        .returning("*");

      // Fallback to currentUser if update did not change anything
      const finalUser = updatedUser || currentUser;

      // Send OTP
      if (isEmailUpdate) {
        const template = await db("emailtemplates")
          .where({ slug: "Send-OTP", status: 1 })
          .select("subject", "content")
          .first();

        const subject = template?.subject || "Your One-Time Password (OTP)";
        const html = template
          ? require("../../utils/functions").replaceTemplateVars(
            template.content,
            {
              email: normalizedEmail,
              otp,
            }
          )
          : `<p>Your One-Time Password (OTP) is: <strong>${otp}</strong></p>`;

        await sendOtpToUser({ email: normalizedEmail, otp, subject, html });
      }

      if (isPhoneUpdate) {
        await sendOtpToUser({ phone, otp });
      }

      return apiResponse.successResponseWithData(
        res,
        isEmailUpdate && isPhoneUpdate
          ? "OTP sent for email and phone update verification"
          : isEmailUpdate
            ? "OTP sent for email update verification"
            : "OTP sent for phone update verification",
        { otp }
      );
    } catch (error) {
      console.error("Update email error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async verifyEmail(req, res) {
    try {
      const { email, phone, otp } = req.body;

      // At least one of email or phone is required
      if ((!email && !phone) || !otp) {
        return apiResponse.ErrorResponse(res, USER.emailOrPhoneOTPisRequired);
      }

      const data = await db("users").where("id", req.user.id).first();

      if (!data) {
        return apiResponse.ErrorResponse(res, USER.accountNotExists);
      }

      // Check if OTP matches
      if (data.otp !== otp) {
        return apiResponse.ErrorResponse(res, USER.otpNotMatched);
      }

      // Check if OTP is expired
      const now = new Date();
      if (!data.otp_expires || new Date(data.otp_expires) < now) {
        return apiResponse.ErrorResponse(res, USER.otpExpired);
      }

      const insertData = {
        otp: null,
        otp_expires: null,
        updated_at: db.fn.now(),
      };

      if (email) insertData.email = email;
      if (phone) insertData.phone = phone;

      // OTP valid — update user verification status
      const [updatedUser] = await db("users")
        .where("id", req.user.id)
        .update(insertData)
        .returning("*");

      const slug = email ? "Email-Updated" : "Phone-Updated";
      const template = await db("notification_templates")
        .where({ slug, status: 1 })
        .first();

      let title = email ? "Email Updated" : "Phone Number Updated";
      let content = email
        ? `Your email has been successfully updated to ${email}.`
        : `Your phone number has been successfully updated to ${phone}.`;

      if (template) {
        title = template.title || title;
        content = template.content
          .replace("{{email}}", email || "")
          .replace("{{phone}}", phone || "");
      }

      // Insert DB notification
      await db("notifications").insert({
        user_id: req.user.id,
        title,
        content,
        is_read: false,
        sent_at: db.fn.now(),
        created_at: db.fn.now(),
      });

      // ✅ Send FCM push
      if (updatedUser.ftoken) {
        try {
          await sendPushNotificationFCM(updatedUser.ftoken, title, content);
        } catch (pushError) {
          console.error("❌ FCM push failed:", pushError);
        }
      }

      // Generate JWT token after successful verification
      const token = jwt.sign({ id: data.id, role: "user" }, config.jwtSecret, {
        expiresIn: "24h",
      });

      const user = await db("users")
        .where("id", req.user.id)
        .first()
        .returning("*");

      return apiResponse.successResponseWithData(res, USER.otpVerified, {
        token,
        user,
      });
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getAboutUs(req, res) {
    try {
      let condition = { status: 1 };

      if (req.url == "/getTerms") {
        condition.slug = process.env.TERMS;
      } else if (req.url == "/getPrivacy") {
        condition.slug = process.env.PRIVACY_POLICY;
      } else if (req.url == "/getHowToPlay") {
        condition.slug = process.env.HOW_TO_PLAY;
      } else if (req.url == "/getCommunityGuidelines") {
        condition.slug = process.env.COMMUNITY_GUIDELINES;
      } else if (req.url == "/getLicenceInformation") {
        condition.slug = process.env.LICENSE_INFORMATION;
      } else {
        condition.slug = process.env.ABOUT_US;
      }

      //Find content details
      const content = await db("cms").where(condition).select("*").first();

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        content
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getBanners(req, res) {
    try {
      let condition = { status: 1 };

      const today = new Date();

      const content = await db("banner")
        .where(condition)
        .andWhere("start_date", "<=", today)
        .andWhere("end_date", ">=", today)
        .select("*");

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        content
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
  async getHowtoPlay(req, res) {
    try {
      const result = await db("how_to_play")
        .where({ status: true })
        .orderBy("created_at", "desc");

      const transformedData = {
        tabs: [],
        tabData: {},
        banners: [],
      };

      result.forEach((tab) => {
        transformedData.tabs.push(tab.tab);

        if (tab.banner_image) {
          transformedData.banners.push(tab.banner_image);
        }

        // Parse the stored JSON data
        const dataObj =
          typeof tab.data === "string" ? JSON.parse(tab.data) : tab.data;

        if (dataObj.sections && dataObj.sections.length > 0) {
          transformedData.tabData[tab.tab] = dataObj.sections.map((section) => {
            const accordion = {
              id: section.title.toLowerCase().replace(/\s+/g, "-"),
              title: section.title,
              content: {},
            };

            // Points → "important"
            if (section.points && section.points.length > 0) {
              accordion.content.important = section.points.map((point) => ({
                label: point.label,
                value: point.value,
                ...(point.note && { note: point.note }),
              }));
            }

            // Dropdowns → only added dropdowns
            if (
              section.dropdowns &&
              Object.keys(section.dropdowns).length > 0
            ) {
              Object.entries(section.dropdowns).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                  // For new format where dropdown itself is an array
                  accordion.content[key] = value.map((item) => ({
                    label: item.label,
                    value: item.value,
                  }));
                } else if (value.items && value.items.length > 0) {
                  // Old format with { name, items }
                  accordion.content[value.name] = value.items.map((item) => ({
                    label: item.label,
                    value: item.value,
                  }));
                }
              });
            }

            // Content → "rules"
            if (section.content && section.content.length > 0) {
              accordion.content.rules = section.content.map((text) => {
                const parts = text.split(":");
                return {
                  label: parts[0]?.trim(),
                  value: parts[1]?.trim() || "",
                };
              });
            }

            return accordion;
          });
        }
      });

      return apiResponse.successResponseWithData(
        res,
        SUCCESS.dataFound,
        transformedData
      );
    } catch (err) {
      console.error(err);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getFaqs(req, res) {
    try {
      let condition = { status: 1 };

      //Find content details
      const data = await db("faq").where(condition).select("*");

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, data);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async getReferralCode(req, res) {
    try {
      const user = await db("users")
        .where("id", req.user.id)
        .select("id", "referral_code")
        .first();

      if (!user) {
        return apiResponse.ErrorResponse(res, USER.accountNotExists);
      }

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, user);
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },

  async deleteAccount(req, res) {
    try {
      const user = await db("users")
        .where("id", req.user.id)
        .update({ status: 2, updated_at: db.fn.now() })
        .returning("*");

      return apiResponse.successResponseWithData(
        res,
        USER.accountDeleted,
        user
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
  async getNotifications(req, res) {
    try {
      const { pageSize = 10, pageNumber = 1, readStatus = null } = req.body;
      const offset = (pageNumber - 1) * pageSize;

      // base query
      const baseQuery = db("notifications").where("user_id", req.user.id);

      if (readStatus !== null) {
        baseQuery.andWhere("is_read", readStatus);
      }

      baseQuery.andWhere(function () {
        this.where(function () {
          this.whereNull("status").andWhere("sent_at", "<=", db.fn.now());
        }).orWhere(function () {
          this.where("status", 1).andWhere("sent_at", "<=", db.fn.now());
        });
      });

      // total records count
      const totalResult = await baseQuery.clone().count("* as total").first();
      const totalRecords = totalResult ? parseInt(totalResult.total) : 0;

      // fetch paginated notifications
      const notifications = await baseQuery
        .clone()
        .select("id", "title", "content", "is_read", "created_at", "sent_at")
        .orderByRaw("COALESCE(sent_at, created_at) DESC")
        .limit(pageSize)
        .offset(offset);

      const today = moment().startOf("day");
      const yesterday = moment().subtract(1, "days").startOf("day");

      const grouped = {
        Today: [],
        Yesterday: [],
        Older: [],
      };

      const translatedNotifications = await Promise.all(
        notifications.map(async (notification) => {
          const displayTime = notification.sent_at || notification.created_at;
          const createdAt = moment(displayTime);

          const now = moment();
          const diffMinutes = now.diff(createdAt, "minutes");
          const diffHours = now.diff(createdAt, "hours");
          const diffDays = now.diff(createdAt, "days");

          let timeAgo;
          if (diffMinutes < 60) {
            timeAgo = `${diffMinutes} min ago`;
          } else if (diffHours < 24) {
            timeAgo = `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
          } else {
            timeAgo = `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
          }

          const translated = await translateNotificationData(notification);

          const notifData = {
            id: notification.id.toString(),
            title: translated.title,
            time: timeAgo,
            content: translated.content,
            is_read: notification.is_read,
          };

          if (createdAt.isSame(today, "day")) {
            grouped.Today.push(notifData);
          } else if (createdAt.isSame(yesterday, "day")) {
            grouped.Yesterday.push(notifData);
          } else {
            grouped.Older.push(notifData);
          }

          return notifData;
        })
      );

      const result = [];
      if (grouped.Today.length)
        result.push({ title: "Today", data: grouped.Today });
      if (grouped.Yesterday.length)
        result.push({ title: "Yesterday", data: grouped.Yesterday });
      if (grouped.Older.length)
        result.push({ title: "Older", data: grouped.Older });

      return apiResponse.successResponseWithData(
        res,
        NOTIFICATION.notificationfetched,
        { result, totalRecords, pageNumber, pageSize }
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.NoDataFound);
    }
  },


  async readNotification(req, res) {
    try {
      const { id } = req.body;

      if (!id) {
        return apiResponse.ErrorResponse(
          res,
          NOTIFICATION.notificationIDRequired
        );
      }

      // First check if notification exists
      const notification = await db("notifications")
        .where({
          id: id,
          user_id: req.user.id,
        })
        .first();

      if (!notification) {
        return apiResponse.ErrorResponse(
          res,
          NOTIFICATION.notificationNotFound
        );
      }

      const updatedRows = await db("notifications")
        .where({
          id: id,
          user_id: req.user.id,
        })
        .update({
          is_read: true,
          read_at: db.fn.now(),
        })
        .returning("*");

      const translatedNotification = await translateNotificationData(
        updatedRows[0]
      );

      return apiResponse.successResponseWithData(
        res,
        NOTIFICATION.notificationRead,
        {
          ...translatedNotification,
          id: updatedRows[0].id,
          user_id: updatedRows[0].user_id,
          is_read: updatedRows[0].is_read,
          sent_at: updatedRows[0].sent_at,
          read_at: updatedRows[0].read_at,
          created_at: updatedRows[0].created_at,
          status: updatedRows[0].status,
          match_id: updatedRows[0].match_id,
        }
      );
    } catch (error) {
      console.error("Error in readNotification:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
  async markAllAsRead(req, res) {
    try {
      const updatedRows = await db("notifications")
        .where({
          user_id: req.user.id,
          is_read: false,
        })
        .update({
          is_read: true,
          read_at: db.fn.now(),
        });

      if (!updatedRows || updatedRows.length === 0) {
        return apiResponse.ErrorResponse(
          res,
          NOTIFICATION.notificationNotFound
        );
      }
      return apiResponse.successResponse(
        res,
        NOTIFICATION.allNotificationsMarkedRead
      );
    } catch (error) {
      console.error(error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
  async updatesetisNotification(req, res) {
    try {
      const userId = req.user.id;

      const user = await db("users").where("id", userId).first("permission");

      if (!user) {
        return apiResponse.ErrorResponse(res, USER.userNotFound);
      }

      let permissions = user.permission || {};

      const currentValue = permissions.set_isNotification === true;
      permissions.set_isNotification = !currentValue;

      await db("users").where("id", userId).update({
        permission: permissions,
        updated_at: db.fn.now(),
      });

      const message = permissions.set_isNotification
        ? NOTIFICATION.notificationsmarkedtrue
        : NOTIFICATION.notificationsmarkedfalse;

      return apiResponse.successResponse(res, message);
    } catch (err) {
      console.error("Error updating notification settings:", err);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
  async followUnfollow(req, res) {
    try {
      const { following_id, action } = req.body;
      const follower_id = req.user.id;

      if (!following_id) {
        return apiResponse.ErrorResponse(res, FOLLOW.followingUserIDRequired);
      }

      if (follower_id === following_id) {
        return apiResponse.ErrorResponse(res, FOLLOW.cannotFollowYourself);
      }

      const blockCheck = await db("block_unblock")
        .where(function () {
          this.where({
            blocker_id: follower_id,
            blocked_id: following_id,
          }).orWhere({
            blocker_id: following_id,
            blocked_id: follower_id,
          });
        })
        .first();

      if (blockCheck) {
        return apiResponse.ErrorResponse(res, FOLLOW.cannotFollowBlockedUser);
      }

      const userToFollow = await db("users").where("id", following_id).first();
      if (!userToFollow) {
        return apiResponse.ErrorResponse(res, USER.userNotFound);
      }

      const existingFollow = await db("follow_unfollow")
        .where({
          follower_id: follower_id,
          following_id: following_id,
        })
        .first();

      if (action === "follow") {
        if (existingFollow) {
          return apiResponse.ErrorResponse(
            res,
            `You already follow ${userToFollow.name}`
          );
        }

        await db("follow_unfollow").insert({
          follower_id: follower_id,
          following_id: following_id,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        });

        return apiResponse.successResponse(
          res,
          `You followed ${userToFollow.name}`
        );
      } else if (action === "unfollow") {
        if (!existingFollow) {
          return apiResponse.ErrorResponse(
            res,
            `You are not following ${userToFollow.name}`
          );
        }

        await db("follow_unfollow")
          .where({
            follower_id: follower_id,
            following_id: following_id,
          })
          .del();

        return apiResponse.successResponse(
          res,
          `You unfollowed ${userToFollow.name}`
        );
      } else {
        return apiResponse.ErrorResponse(res, FOLLOW.Invalidaction);
      }
    } catch (error) {
      console.error("Follow/Unfollow error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
  async blockUnblock(req, res) {
    try {
      const { blocked_id, action } = req.body;
      const blocker_id = req.user.id;

      if (!blocked_id) {
        return apiResponse.ErrorResponse(res, FOLLOW.Blockeduseridrequired);
      }

      if (blocker_id === blocked_id) {
        return apiResponse.ErrorResponse(res, FOLLOW.cannotblockyourself);
      }

      const userToBlock = await db("users").where("id", blocked_id).first();
      if (!userToBlock) {
        return apiResponse.ErrorResponse(res, USER.userNotFound);
      }

      const existingBlock = await db("block_unblock")
        .where({
          blocker_id: blocker_id,
          blocked_id: blocked_id,
        })
        .first();

      if (action === "block") {
        if (existingBlock) {
          return apiResponse.ErrorResponse(
            res,
            `You have already blocked ${userToBlock.name}`
          );
        }

        await db.transaction(async (trx) => {
          await trx("follow_unfollow")
            .where(function () {
              this.where({
                follower_id: blocker_id,
                following_id: blocked_id,
              }).orWhere({
                follower_id: blocked_id,
                following_id: blocker_id,
              });
            })
            .del();

          await trx("block_unblock").insert({
            blocker_id: blocker_id,
            blocked_id: blocked_id,
            created_at: trx.fn.now(),
            updated_at: trx.fn.now(),
          });
        });

        return apiResponse.successResponse(
          res,
          `You have blocked ${userToBlock.name}`
        );
      } else if (action === "unblock") {
        if (!existingBlock) {
          return apiResponse.ErrorResponse(
            res,
            `You have not blocked ${userToBlock.name}`
          );
        }

        await db("block_unblock")
          .where({
            blocker_id: blocker_id,
            blocked_id: blocked_id,
          })
          .del();

        return apiResponse.successResponse(
          res,
          `You have unblocked ${userToBlock.name}`
        );
      } else {
        return apiResponse.ErrorResponse(res, FOLLOW.Invalidaction);
      }
    } catch (error) {
      console.error("Block/Unblock error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
  async reportProfile(req, res) {
    try {
      const { reported_user_id } = req.body;
      const reporter_id = req.user.id;

      if (!reported_user_id) {
        return res.status(400).json({
          success: false,
          message: USER.reporteduserIDrequired,
        });
      }

      if (reporter_id === reported_user_id) {
        return res.status(400).json({
          success: false,
          message: USER.cannotreportyourself,
        });
      }

      const reportedUser = await db("users")
        .where("id", reported_user_id)
        .first();

      if (!reportedUser) {
        return res.status(404).json({
          success: false,
          message: USER.userNotFound,
        });
      }

      const reportedArr = reportedUser.is_reported_Arr || [];

      if (reportedArr.includes(reporter_id)) {
        return res.status(400).json({
          success: false,
          message: USER.alreadyreportedthisuser,
        });
      }

      const updatedReportedArr = [...reportedArr, reporter_id];

      await db("users").where("id", reported_user_id).update({
        is_reported_Arr: updatedReportedArr,
        updated_at: db.fn.now(),
      });

      return apiResponse.successResponse(res, USER.reportProfile);
    } catch (error) {
      console.error("Error in reportProfile:", error);
    }
  },
  async getUserProfileById(req, res) {
    try {
      const profileUserId = req.params.id;
      const viewerUserId = req.user.id;
      if (!profileUserId) {
        return apiResponse.ErrorResponse(res, USER.userIDrequired);
      }

      const user = await db("users")
        .where("id", profileUserId)
        .select("*")
        .first();

      if (!user) {
        return apiResponse.ErrorResponse(res, USER.userNotFound);
      }
      user.image_url = user.image_url
        ? `${config.baseURL}/${user.image_url}`
        : "";

      const isBlocked = await db("block_unblock")
        .where({ blocker_id: viewerUserId, blocked_id: profileUserId })
        .first();

      let isFollowing = false;
      if (!isBlocked) {
        isFollowing = await db("follow_unfollow")
          .where({ follower_id: viewerUserId, following_id: profileUserId })
          .first();
      }

      user.is_blocked = !!isBlocked;
      user.isFollowing = !isBlocked && !!isFollowing;

      let isReported = false;
      const reportedArr = user.is_reported_Arr || [];

      if (reportedArr.includes(viewerUserId)) {
        isReported = true;
      }

      const [followersCount, followingCount] = await Promise.all([
        db("follow_unfollow")
          .where("following_id", profileUserId)
          .count("* as count")
          .first(),
        db("follow_unfollow")
          .where("follower_id", profileUserId)
          .count("* as count")
          .first(),
      ]);

      user.followers_count = parseInt(followersCount.count) || 0;
      user.following_count = parseInt(followingCount.count) || 0;
      user.is_Reported = isReported;

      const [followersList, followingList] = await Promise.all([
        db("follow_unfollow")
          .where("following_id", profileUserId)
          .select("following_id"),

        db("follow_unfollow")
          .where("follower_id", profileUserId)
          .select("follower_id"),
      ]);

      user.followers_list = followersList || [];
      user.following_list = followingList || [];

      const contestsResult = await db("fantasy_games")
        .where("user_id", profileUserId)
        .countDistinct("contest_id as count")
        .first();

      const contestsCount = parseInt(contestsResult.count) || 0;

      const matchesResult = await db("fantasy_teams")
        .where("user_id", profileUserId)
        .countDistinct("match_id as count")
        .first();
      const matchesCount = parseInt(matchesResult.count) || 0;

      const seriesResult = await db("fantasy_teams as ft")
        .join("matches as m", "ft.match_id", "m.id")
        .where("ft.user_id", profileUserId)
        .countDistinct("m.tournament_id as count")
        .first();
      const seriesCount = parseInt(seriesResult.count) || 0;

      const winningsResult = await db("fantasy_games as fg")
        .join("contests as c", "fg.contest_id", "c.id")
        .where("fg.user_id", profileUserId)
        .where("fg.rank", ">", 0)
        .select(
          db.raw("COUNT(*) as contests_won"),
          db.raw(`
            SUM(
              CASE 
                WHEN fg.rank = 1 AND c.winnings IS NOT NULL THEN 
                  (c.winnings->>'1')::numeric 
                WHEN fg.rank = 2 AND c.winnings IS NOT NULL THEN 
                  (c.winnings->>'2')::numeric
                WHEN fg.rank = 3 AND c.winnings IS NOT NULL THEN 
                  (c.winnings->>'3')::numeric
                ELSE 0 
              END
            ) as total_winnings
          `)
        )
        .first();

      const pointsResult = await db("fantasy_teams")
        .where("user_id", profileUserId)
        .sum("total_points as total_points")
        .first();

      const bestRankResult = await db("fantasy_games")
        .where("user_id", profileUserId)
        .whereNotNull("rank")
        .min("rank as best_rank")
        .first();

      const winPercentage =
        contestsCount > 0
          ? Math.round((winningsResult.contests_won / contestsCount) * 100)
          : 0;

      const Usersallcontests = await db("fantasy_games")
        .where("user_id", profileUserId)
        .orderBy("updated_at", "desc")
        .limit(2);

      const skillScoreResult = await db("fantasy_teams")
        .where("user_id", profileUserId)
        .sum("total_points as total_points")
        .first();
      const skillScore = parseFloat(skillScoreResult.total_points) || 0;
      user.skill_score = skillScore;

      user.careerStats = {
        contests: {
          total: contestsCount,
          won: parseInt(winningsResult.contests_won) || 0,
          winPercentage: winPercentage,
          totalWinnings: parseFloat(winningsResult.total_winnings) || 0,
        },
        matches: {
          total: matchesCount,
          totalPoints: parseFloat(pointsResult.total_points) || 0,
          bestRank: parseInt(bestRankResult.best_rank) || null,
        },
        series: {
          total: seriesCount,
        },
      };

      const recentMatches = await db("fantasy_games as fg")
        .join("contests as c", "fg.contest_id", "c.id")
        .join("matches as m", "c.match_id", "m.id")
        .join("teams as t1", "m.team1_id", "t1.id")
        .join("teams as t2", "m.team2_id", "t2.id")
        .join("fantasy_teams as ft", "fg.fantasy_team_id", "ft.id")
        .where("fg.user_id", profileUserId)
        .select(
          "m.id as match_id",
          "m.start_time as match_date",
          "m.status as match_status",
          "t1.name as team1_name",
          "t1.short_name as team1_short_name",
          "t1.logo_url as team1_logo",
          "t2.name as team2_name",
          "t2.short_name as team2_short_name",
          "t2.logo_url as team2_logo",
          "ft.name as fantasy_team_name",
          "ft.total_points as fantasy_team_points",
          "fg.rank as user_rank",
          "fg.points as user_points",
          "fg.status as entry_status",
          db.raw("COUNT(DISTINCT fg2.id) as total_contestants"),
          db.raw(
            "COUNT(DISTINCT CASE WHEN fg2.rank = 1 THEN fg2.id END) as contests_won"
          ),
          db.raw(`
            (
              SELECT ft2.total_points 
              FROM fantasy_teams ft2 
              WHERE ft2.match_id = m.id 
              ORDER BY ft2.total_points DESC 
              LIMIT 1
            ) as highest_points
          `),
          db.raw(`
            (
              SELECT CONCAT('T', ft2.id::text)
              FROM fantasy_teams ft2 
              WHERE ft2.match_id = m.id 
              ORDER BY ft2.total_points DESC 
              LIMIT 1
            ) as highest_points_team_name
          `),
          db.raw(`
            (
              SELECT COUNT(*) 
              FROM fantasy_teams ft3 
              WHERE ft3.match_id = m.id 
              AND ft3.user_id = ${profileUserId}
            ) as teams_created
          `),
          db.raw(`
            (
              SELECT COALESCE(SUM(
                CASE 
                  WHEN c2.prize_pool IS NOT NULL THEN 
                    (c2.prize_pool)::numeric 
                  ELSE 0 
                END
              ), 0)
              FROM contests c2 
              WHERE c2.match_id = m.id
            ) as total_prize_pool
          `)
        )
        .leftJoin("fantasy_games as fg2", function () {
          this.on("fg2.contest_id", "=", "c.id");
        })
        .groupBy(
          "m.id",
          "m.start_time",
          "m.status",
          "t1.name",
          "t1.short_name",
          "t1.logo_url",
          "t2.name",
          "t2.short_name",
          "t2.logo_url",
          "ft.name",
          "ft.total_points",
          "fg.rank",
          "fg.points",
          "fg.status"
        )
        .orderBy("m.start_time", "desc")
        .limit(10);

      // Process match data
      const processedMatches = recentMatches.map((match) => {
        const matchObj = {
          ...match,
          total_contestants: parseInt(match.total_contestants) || 0,
          contests_won: parseInt(match.contests_won) || 0,
          highest_points: parseFloat(match.highest_points) || 0,
          highest_points_team_name: match.highest_points_team_name || null,
          teams_created: parseInt(match.teams_created) || 0,
          total_prize_pool: parseFloat(match.total_prize_pool) || 0,
          match_date: match.match_date
            ? new Date(match.match_date).toISOString()
            : null,
        };
        return matchObj;
      });

      user.recent_matches = processedMatches;

      return apiResponse.successResponseWithData(res, SUCCESS.dataFound, user);
    } catch (error) {
      console.error("getUserProfile error:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
  async scorecardList(req, res) {
    try {
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setDate(todayEnd.getDate() + 7);
      todayEnd.setHours(23, 59, 59, 999);

      // Statuses for live and upcoming
      const liveStatuses = [
        "Live",
        "1st Innings",
        "2nd Innings",
        "3rd Innings",
        "4th Innings",
      ];
      const nsStatuses = ["NS", "Not Started"];

      // Query for today's matches that are either live or NS
      const matches = await db("matches as m")
        .whereBetween("m.start_time", [todayStart, todayEnd])
        .where(function () {
          this.whereIn("m.status", liveStatuses).orWhereIn(
            "m.status",
            nsStatuses
          );
        })
        .leftJoin("teams as t1", "m.team1_id", "t1.id")
        .leftJoin("teams as t2", "m.team2_id", "t2.id")
        .leftJoin("tournaments as trn", "m.tournament_id", "trn.id")
        .select(
          "m.id as match_id",
          "m.start_time",
          "m.status",
          "t1.name as team1_name",
          "t1.logo_url as team1_logo",
          "t2.name as team2_name",
          "t2.logo_url as team2_logo",
          "trn.name as tournament_name"
        )
        .orderBy("m.start_time", "asc");

      // Flat array, each item includes all required fields, with formatted time
      const data = matches.map((match) => ({
        match_id: match.match_id,
        start_time: match.start_time,
        start_time_formatted: match.start_time
          ? require("moment")(match.start_time).format("ddd, D MMM h:mm A")
          : null,
        status: match.status,
        team1_name: match.team1_name,
        team1_logo: match.team1_logo,
        team2_name: match.team2_name,
        team2_logo: match.team2_logo,
        tournament_name: match.tournament_name,
      }));

      return apiResponse.successResponseWithData(
        res,
        "Today's live and upcoming matches",
        data
      );
    } catch (error) {
      console.error("Error in scorecardList:", error);
      return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
    }
  },
};

module.exports = userAuthController;