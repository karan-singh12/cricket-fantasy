const { knex: db } = require("../../config/database");
const apiResponse = require("../../utils/apiResponse");
const { sendPushNotificationFCM } = require("../../utils/functions");
const { ERROR, SUCCESS, NOTIFICATION } = require("../../utils/responseMsg");

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
      const users = await db("users")
        .whereIn("id", user_ids)
        .select("id", "ftoken");

      const notifications = [];
      const fcmResults = { sent: 0, failed: 0, invalidTokens: 0 };

      for (const user of users) {
        notifications.push({
          user_id: user.id,
          title,
          content,
          is_read: false,
          sent_at: db.fn.now(),
          created_at: db.fn.now(),
        });

        if (user.ftoken) {
          try {
            await sendPushNotificationFCM(user.ftoken, title, content);
            fcmResults.sent += 1;
            console.log(`FCM notification sent to user ${user.id}`);
          } catch (error) {
            fcmResults.failed += 1;
            if (error.code === "messaging/registration-token-not-registered") {
              fcmResults.invalidTokens += 1;
            }
            console.log(
              `Failed to send FCM to user ${user.id}: ${error.message}`
            );
          }
        } else {
          console.log(
            `No ftoken for user ${user.id}, skipping FCM notification`
          );
        }
      }

      if (notifications.length > 0) {
        await db("notifications").insert(notifications);
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
