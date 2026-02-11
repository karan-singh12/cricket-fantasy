const axios = require("axios");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const connectDB = require("../config/mongoose");
const User = require("../models/User");
const Match = require("../models/Match");
const Contest = require("../models/Contest");
const Player = require("../models/Player");
const Tournament = require("../models/Tournament");
const config = require("../config/config");

const BASE_URL = "http://localhost:3001";

const verifyApis = async () => {
    try {
        await connectDB();
        console.log("Connected to DB for API Verification...");

        const user = await User.findOne({ email: "testuser@example.com" });
        if (!user) throw new Error("Test user not found. Run seeding script first.");

        const token = jwt.sign({ id: user._id, role: user.role }, config.jwtSecret, {
            expiresIn: "1h",
        });
        console.log("Generated Token for Test User.");

        const headers = { Authorization: `Bearer ${token}` };
        const axiosConfig = { headers, timeout: 10000 };

        // 0. Health Check
        console.log("--- Testing Health Check ---");
        const healthRes = await axios.get(`${BASE_URL}/api/health`, { timeout: 10000 }).catch(e => e.response);
        if (healthRes && healthRes.status === 200) {
            console.log("✅ Health Check Success");
        } else {
            console.log("❌ Health Check Failed", healthRes ? healthRes.status : "No Response");
        }

        const tournament = await Tournament.findOne({ sportmonks_id: 12345 });
        if (!tournament) throw new Error("Seeded tournament not found.");

        // 1. Get Matches
        console.log("--- Testing Get Matches ---");
        const matchesRes = await axios.get(`${BASE_URL}/api/user/matches/${tournament._id}/getAllmatchesOfTournament`, axiosConfig).catch(e => e.response);
        if (matchesRes && matchesRes.status === 200) {
            console.log("✅ Get Matches Success");
        } else {
            console.log("❌ Get Matches Failed", matchesRes ? matchesRes.status : "No Response", matchesRes ? matchesRes.data : "");
        }

        const match = await Match.findOne({ sportmonks_id: 99999 });
        if (!match) throw new Error("Seeded match not found.");

        // 2. Get Contests
        console.log("--- Testing Get Contests ---");
        const contestsRes = await axios.post(`${BASE_URL}/api/user/contests/getAllContest`, { matchId: match._id }, axiosConfig).catch(e => e.response);
        if (contestsRes && contestsRes.status === 200) {
            console.log("✅ Get Contests Success");
        } else {
            console.log("❌ Get Contests Failed", contestsRes ? contestsRes.status : "No Response", contestsRes ? contestsRes.data : "");
        }

        const contest = await Contest.findOne({ match: match._id });
        if (!contest) throw new Error("Seeded contest not found.");

        // 3. Create Fantasy Team (Draft)
        console.log("--- Testing Create Fantasy Team ---");
        const createTeamRes = await axios.post(`${BASE_URL}/api/user/fantasyTeams/createFantasyTeam`, { match_id: match._id, name: "Test Team 1" }, axiosConfig).catch(e => e.response);
        let teamId;
        let selectPlayersRes;
        let joinRes;

        if (createTeamRes && (createTeamRes.status === 200 || createTeamRes.status === 201)) {
            console.log("✅ Create Team Success");
            teamId = createTeamRes.data.data._id;
        } else {
            console.log("❌ Create Team Failed", createTeamRes ? createTeamRes.status : "No Response", createTeamRes ? createTeamRes.data : "");
        }

        if (teamId) {
            // 4. Select Players
            console.log("--- Testing Select Players ---");
            const players = await Player.find({ team: { $in: [match.team1, match.team2] } }).limit(11);
            const playerPayload = players.map((p, idx) => ({
                player_id: p._id,
                is_captain: idx === 0,
                is_vice_captain: idx === 1
            }));

            selectPlayersRes = await axios.post(`${BASE_URL}/api/user/fantasyTeams/selectPlayers`, {
                fantasy_team_id: teamId,
                players: playerPayload
            }, axiosConfig).catch(e => e.response);

            if (selectPlayersRes && selectPlayersRes.status === 200) {
                console.log("✅ Select Players Success");
            } else {
                console.log("❌ Select Players Failed", selectPlayersRes ? selectPlayersRes.status : "No Response", selectPlayersRes ? selectPlayersRes.data : "");
            }

            // 5. Join Contest
            console.log("--- Testing Join Contest ---");
            joinRes = await axios.post(`${BASE_URL}/api/user/fantasyTeams/joinContest`, {
                fantasy_team_id: teamId,
                contest_id: contest._id
            }, axiosConfig).catch(e => e.response);

            if (joinRes && joinRes.status === 200) {
                console.log("✅ Join Contest Success");
            } else {
                console.log("❌ Join Contest Failed", joinRes ? joinRes.status : "No Response", joinRes ? joinRes.data : "");
            }
        }

        console.log("API Verification Summary:");
        console.log("- Health Check: ", healthRes && healthRes.status === 200 ? "PASS" : "FAIL");
        console.log("- Matches: ", matchesRes && matchesRes.status === 200 ? "PASS" : "FAIL");
        console.log("- Contests: ", contestsRes && contestsRes.status === 200 ? "PASS" : "FAIL");
        console.log("- Create Team: ", createTeamRes && (createTeamRes.status === 200 || createTeamRes.status === 201) ? "PASS" : "FAIL");
        console.log("- Select Players: ", selectPlayersRes && selectPlayersRes.status === 200 ? "PASS" : "FAIL");
        console.log("- Join Contest: ", joinRes && joinRes.status === 200 ? "PASS" : "FAIL");

        process.exit(0);
    } catch (error) {
        console.error("Verification failed:", error);
        process.exit(1);
    }
};

verifyApis();