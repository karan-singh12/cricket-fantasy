const mongoose = require("mongoose");
const connectDB = require("../config/mongoose");
const Tournament = require("../models/Tournament");
const Team = require("../models/Team");
const Player = require("../models/Player");
const PlayerTeam = require("../models/PlayerTeam");
const Match = require("../models/Match");
const MatchPlayer = require("../models/MatchPlayer");
const Venue = require("../models/Venue");
const Contest = require("../models/Contest");
const User = require("../models/User");
const Wallet = require("../models/Wallet");

const seedData = async () => {
    try {
        await connectDB();
        console.log("Connected to MongoDB for seeding...");

        // 1. Create Tournament
        const tournament = await Tournament.findOneAndUpdate(
            { sportmonks_id: 12345 },
            {
                name: "Demo Premier League 2026",
                short_name: "DPL",
                start_date: new Date(),
                end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                type: "league",
                status: "active"
            },
            { upsert: true, new: true }
        );
        console.log("Tournament created:", tournament.name);

        // 2. Create Teams
        const team1 = await Team.findOneAndUpdate(
            { sportmonks_id: 101 },
            { name: "Alpha Avengers", short_name: "AA", type: "club", country_id: 1 },
            { upsert: true, new: true }
        );
        const team2 = await Team.findOneAndUpdate(
            { sportmonks_id: 102 },
            { name: "Beta Blasters", short_name: "BB", type: "club", country_id: 1 },
            { upsert: true, new: true }
        );
        console.log("Teams created:", team1.name, "&", team2.name);

        // 3. Create Players & PlayerTeam mapping
        const playersData = [
            { name: "Alpha Captain", role: "All-Rounder", team: team1 },
            { name: "Alpha Batsman 1", role: "Batsman", team: team1 },
            { name: "Alpha Bowler 1", role: "Bowler", team: team1 },
            { name: "Alpha Keeper", role: "Wicketkeeper", team: team1 },
            { name: "Beta Captain", role: "All-Rounder", team: team2 },
            { name: "Beta Batsman 1", role: "Batsman", team: team2 },
            { name: "Beta Bowler 1", role: "Bowler", team: team2 },
            { name: "Beta Keeper", role: "Wicketkeeper", team: team2 },
        ];

        const players = [];
        for (let i = 0; i < playersData.length; i++) {
            const pData = playersData[i];
            const player = await Player.findOneAndUpdate(
                { sportmonks_id: 1000 + i },
                {
                    name: pData.name,
                    position: pData.role,
                    team: pData.team._id,
                    credits: 8.5 + (i % 3),
                    short_name: pData.name.split(' ').map(n => n[0]).join('')
                },
                { upsert: true, new: true }
            );
            players.push(player);

            await PlayerTeam.findOneAndUpdate(
                { player: player._id, team: pData.team._id, season_id: 123 },
                { is_active: true },
                { upsert: true }
            );
        }
        console.log(`${players.length} Players created and mapped to teams.`);

        // 4. Create Venue
        const venue = await Venue.findOneAndUpdate(
            { venue_id: 501 },
            { name: "Mega Stadium", city: "Tech City", country_id: 1 },
            { upsert: true, new: true }
        );

        // 5. Create Match
        const match = await Match.findOneAndUpdate(
            { sportmonks_id: 99999 },
            {
                title: "AA vs BB - Match 1",
                short_title: "AA vs BB",
                tournament: tournament._id,
                team1: team1._id,
                team2: team2._id,
                start_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days later
                status: "NS",
                format: "T20",
                venue_id: venue.venue_id
            },
            { upsert: true, new: true }
        );
        console.log("Match created:", match.title);

        // 6. Create Match Players (Lineups)
        for (const player of players) {
            await MatchPlayer.findOneAndUpdate(
                { match: match._id, player: player._id },
                {
                    team: player.team,
                    is_playing_xi: true,
                    role: player.position
                },
                { upsert: true }
            );
        }
        console.log("Match lineups created.");

        // 7. Create Contest for the match
        const contest = await Contest.findOneAndUpdate(
            { match: match._id, entry_fee: 50 },
            {
                prize_pool: 1000,
                max_teams: 100,
                joined_teams: 0,
                max_teams_per_user: 11,
                contest_type: "guaranteed",
                status: "upcoming",
                winnings: { "1": 500, "2": 300, "3": 200 }
            },
            { upsert: true, new: true }
        );
        console.log("Contest created for match:", contest._id);

        // 8. Create Test User
        const testUser = await User.findOneAndUpdate(
            { email: "testuser@example.com" },
            {
                name: "Test User",
                phone: "1234567890",
                status: 1,
                is_verified: true,
                wallet_balance: 5000,
                referral_code: "TEST123"
            },
            { upsert: true, new: true }
        );

        await Wallet.findOneAndUpdate(
            { user: testUser._id },
            { balance: 5000, currency: "BDT" },
            { upsert: true }
        );
        console.log("Test user created with balance 5000.");

        console.log("Seeding completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("Seeding failed:", error);
        process.exit(1);
    }
};

seedData();
