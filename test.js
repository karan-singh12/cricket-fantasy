// test.js
const { io } = require("socket.io-client");

// 👇 तेरा token यहाँ डाल दिया है
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTY3LCJyb2xlIjoidXNlciIsImlhdCI6MTc1NzY2ODk2NCwiZXhwIjoxNzU3NzU1MzY0fQ.t4UzK1k3wh2l52ulZP0Tl_oHwyOozA29FJA9nQt_1G8";

// 👇 तेरा socket server
const socket = io("ws://172.16.2.124:3000", {  //api.mybest11bd.com
  transports: ["websocket"],
  query: { token },
});

socket.on("connect", () => {
  console.log("✅ Connected:", socket.id);

  // Emit event with matchId
  socket.emit("myMatches", { type: "started", matchId: 1112 }); // live matchid 
});

socket.on("receiveMyMatches", (data) => {
  console.log("📥 receiveMyMatches:", JSON.stringify(data, null, 2));
});

socket.on("myMatchesError", (err) => {
  console.error("❌ myMatchesError:", err);
});

socket.on("disconnect", (reason) => {
  console.log("❌ Disconnected:", reason);
});

socket.on("connect_error", (err) => {
  console.error("❌ Connect error:", err.message);
});
