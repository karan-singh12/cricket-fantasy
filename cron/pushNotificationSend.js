const Match = require("../models/Match");
const Notification = require("../models/Notification");
const User = require("../models/User");
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

    console.log(`Checking matches between ${formatTime(now)} and ${formatTime(fiveMinutesFromNow)}`);

    const upcomingMatches = await Match.find({
      start_time: { $gt: now, $lte: fiveMinutesFromNow },
      status: { $nin: ["Finished", "Aban."] }
    });

    if (!upcomingMatches.length) {
      console.log("No upcoming matches found in this time window");
      return;
    }

    for (const match of upcomingMatches) {
      const formattedStart = formatTime(new Date(match.start_time));
      console.log(`Processing match ${match._id} (Starts at ${formattedStart})`);

      // Find unsent notifications for this match
      const notifications = await Notification.find({
        match: match._id,
        status: true,
        $or: [
          { sent_at: { $exists: false } },
          { sent_at: null },
          { sent_at: { $lt: new Date(now.getTime() - 5 * 60000) } }
        ],
        title: { $regex: /Match|starting soon|Reminder/i }
      }).populate('user');

      const usersToNotify = notifications.filter(n => n.user && n.user.ftoken);

      if (!usersToNotify.length) {
        console.log(`No users to notify for match ${match._id}`);
        continue;
      }

      const matchName = match.match_number || `Match ${match._id}`;
      const title = "Match Starting Soon!";
      const BATCH_SIZE = 100;

      for (let i = 0; i < usersToNotify.length; i += BATCH_SIZE) {
        const batch = usersToNotify.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (notif) => {
            const user = notif.user;
            try {
              await sendPushNotificationFCM(
                user.ftoken,
                title,
                notif.content || `Your match ${matchName} is about to begin`,
                {
                  match_id: match._id.toString(),
                  type: "match_reminder",
                }
              );

              notif.sent = true;
              notif.sent_at = new Date();
              await notif.save();

              console.log(`✓ Sent to user ${user._id}`);
            } catch (err) {
              console.error(`Failed to notify user ${user._id}:`, err.message);
              if (err.code === "messaging/registration-token-not-registered") {
                await User.findByIdAndUpdate(user._id, { ftoken: null });
              }
            }
          })
        );
      }
    }
  } catch (error) {
    console.error("Critical error in checkAndSendMatchNotifications:", error);
  }
}

module.exports = checkAndSendMatchNotifications;
