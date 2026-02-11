const { knex: db } = require("../config/database");
const { sendPushNotificationFCM } = require("../utils/functions");

const formatTime = (date) =>
  date.toLocaleString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

async function checkAndSendMatchNotifications() {
  try {
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60000);

    console.log(
      `Checking matches between ${formatTime(now)} and ${formatTime(
        fiveMinutesFromNow
      )}`
    );

    const upcomingMatches = await db("matches")
      .where("start_time", ">", now)
      .andWhere("start_time", "<=", fiveMinutesFromNow)
      .andWhere("status", "!=", "Finished")
      .andWhere("status", "!=", "Aban.")
      .select("id", "match_number", "start_time", "status");

    if (!upcomingMatches.length) {
      console.log("No upcoming matches found in this time window");
      return;
    }

    console.log(`Found ${upcomingMatches.length} matches to process`);

    for (const match of upcomingMatches) {
      const formattedStart = formatTime(new Date(match.start_time));
      console.log(`Processing match ${match.id} (Starts at ${formattedStart})`);

      // FIXED: Only get match reminder notifications that haven't been sent yet
      const usersToNotify = await db("notifications")
        .where({
          match_id: match.id,
          "notifications.status": true,
        })
        .where(function () {
          this.whereNull("sent_at").orWhere(
            "sent_at",
            "<",
            db.raw(`NOW() - INTERVAL '5 minutes'`)
          );
        })
        .whereNotNull("match_id") // Only match notifications
        .whereRaw("LOWER(notifications.title) LIKE ?", ["%starting soon%"])
        .whereRaw("LOWER(notifications.title) LIKE ?", ["%Match Reminder%"])
        .whereRaw("LOWER(notifications.title) LIKE ?", ["%Match%"]) // Only match starting notifications
        .join("users", "notifications.user_id", "users.id")
        .whereNotNull("users.ftoken")
        .select(
          "users.id as user_id",
          "users.ftoken",
          "notifications.content",
          "notifications.id as notification_id"
        );

      if (!usersToNotify.length) {
        console.log(`No users to notify for match ${match.id}`);
        continue;
      }

      console.log(
        `Sending notifications for match ${match.id} to ${usersToNotify.length} users`
      );

      const matchName = match.match_number || `Match ${match.id}`;
      const title = "Match Starting Soon!";
      const BATCH_SIZE = 100;

      for (let i = 0; i < usersToNotify.length; i += BATCH_SIZE) {
        const batch = usersToNotify.slice(i, i + BATCH_SIZE);
        console.log(
          `🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(
            usersToNotify.length / BATCH_SIZE
          )}`
        );

        await Promise.all(
          batch.map(async (user) => {
            try {
              await sendPushNotificationFCM(
                user.ftoken,
                title,
                user.content || `Your match ${matchName} is about to begin`,
                {
                  match_id: match.id.toString(),
                  type: "match_reminder",
                }
              );

              // FIXED: Update sent_at to prevent re-sending
              await db("notifications")
                .where({ id: user.notification_id })
                .update({
                  sent: true,
                  sent_at: new Date(),
                });

              console.log(`✓ Sent to user ${user.user_id}`);
            } catch (err) {
              console.error(
                `Failed to notify user ${user.user_id}:`,
                err.message
              );

              if (err.code === "messaging/registration-token-not-registered") {
                await db("users")
                  .where({ id: user.user_id })
                  .update({ ftoken: null });
                console.log(
                  `Removed invalid FCM token for user ${user.user_id}`
                );
              }
            }
          })
        );

        if (i + BATCH_SIZE < usersToNotify.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }
  } catch (error) {
    console.error(
      "Critical error in checkAndSendMatchNotifications:",
      error.stack || error
    );
  } finally {
    console.log("Notification check completed");
  }
}

module.exports = checkAndSendMatchNotifications;
