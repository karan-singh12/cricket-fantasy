const socketIo = require("socket.io");
const verifySocketToken = require("../middleware/socketAuth");
const { getContestLeaderboardData } = require("../services/leaderboard");
const { getUserMatches } = require("../services/matches");

const initializeSocket = (server) => {
  const io = socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.use(verifySocketToken);

  io.on("connection", (socket) => {
    console.log(`User ${socket.user.id} connected via socket`);

    //! leaderboard
    // Leaderboard
    socket.on("leaderboard", async ({ contestId }) => {
      try {
        if (!contestId) {
          return socket.emit("leaderboardError", {
            success: false,
            message: "contestId is required",
          });
        }

        // Run immediately once
        const sendLeaderboard = async () => {
          try {
            const result = await getContestLeaderboardData(contestId, socket.user.id);

            if (result.error) {
              return socket.emit("leaderboardError", {
                success: false,
                message: result.error,
              });
            }

            socket.emit("receiveLeaderboard", result);

          } catch (err) {
            console.error("Leaderboard fetch error:", err);
            socket.emit("leaderboardError", {
              success: false,
              message: "Error fetching leaderboard",
            });
          }
        };

        await sendLeaderboard();

        // Schedule every 15 seconds
        const leaderboardInterval = setInterval(sendLeaderboard, 10000);

        // Optional: clear interval when client disconnects
        socket.on("disconnect", () => clearInterval(leaderboardInterval));
      } catch (err) {
        console.error("Leaderboard init error:", err);
      }
    });


    // My Matches
    socket.on("myMatches", async ({ type = "started", matchId }) => {
      try {
        console.log("matchId in live matches",matchId)
        const sendMatches = async () => {
          try {
            const matches = await getUserMatches(socket.user.id, type, matchId);
            // console.log("matches=====>",JSON.stringify(matches))
            socket.emit("receiveMyMatches", { success: true, data: matches });
          } catch (err) {
            console.error("myMatches fetch error:", err);
            socket.emit("myMatchesError", {
              success: false,
              message: "Error fetching matches"
            });
          }
        };

        await sendMatches();
        const matchesInterval = setInterval(sendMatches, 10000);
        socket.on("disconnect", () => clearInterval(matchesInterval));
      } catch (err) {
        console.error("myMatches init error:", err);
      }
    });


    // Continuous push every 5s
    // let interval = setInterval(async () => {
    //   try {
    //     const matches = await getUserMatches(socket.user.id, "Started");

    //     socket.emit("receiveMyMatches", { success: true, data: matches });
    //   } catch (err) {
    //     console.error("Auto myMatches fetch error:", err);
    //   }
    // }, 4000);

    socket.on("disconnect", () => {
      console.log(`User ${socket.user.id} disconnected`);

    });

  });

  return io;
};

module.exports = initializeSocket;
