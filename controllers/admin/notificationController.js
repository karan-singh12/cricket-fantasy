const User = require("../../models/User");
const Notification = require("../../models/Notification");
const apiResponse = require("../../utils/apiResponse");
const { sendPushNotificationFCM } = require("../../utils/functions");
const { ERROR, NOTIFICATION } = require("../../utils/responseMsg");

const NotificationController = {

  async sendNotification(req, res) {
    try {
      const { user_ids, title, content } = req.body;

      if (!Array.isArray(user_ids) || user_ids.length === 0) {
        return apiResponse.validationErrorWithData(
          res,
          "user_ids must be a non-empty array"
        );
      }

      if (!title || !content) {
        return apiResponse.validationErrorWithData(
          res,
          NOTIFICATION.titleAndContentRequired
        );
      }
      const users = await User.find({ _id: { $in: user_ids } })
        .select("ftoken");

      const notifications = [];
      // const fcmResults = { sent: 0, failed: 0, invalidTokens: 0 }; // Not used in response but kept for logic

      for (const user of users) {
        notifications.push({
          user: user._id,
          title,
          content,
          is_read: false,
          sent_at: new Date(),
        });

        if (user.ftoken) {
          try {
            await sendPushNotificationFCM(user.ftoken, title, content);
            // fcmResults.sent += 1;
            console.log(`FCM notification sent to user ${user._id}`);
          } catch (error) {
            // fcmResults.failed += 1;
            if (error.code === "messaging/registration-token-not-registered") {
              // fcmResults.invalidTokens += 1;
              await User.findByIdAndUpdate(user._id, { ftoken: null });
            }
            console.log(
              `Failed to send FCM to user ${user._id}: ${error.message}`
            );
          }
        } else {
          console.log(
            `No ftoken for user ${user._id}, skipping FCM notification`
          );
        }
      }

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }

      return apiResponse.successResponseWithData(
        res,
        NOTIFICATION.notificationSentSuccessfully,
        { count: notifications.length }
      );
    } catch (error) {
      console.error("Error sending notification:", error);
      return apiResponse.ErrorResponse(
        res,
        error.message || ERROR.somethingWrong
      );
    }
  },
};

module.exports = NotificationController;
