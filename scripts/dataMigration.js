const mongoose = require("mongoose");
const { knex } = require("../config/database");
const connectDB = require("../config/mongoose");
const User = require("../models/User");
const Admin = require("../models/Admin");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const Team = require("../models/Team");
const Player = require("../models/Player");
const Tournament = require("../models/Tournament");
const Match = require("../models/Match");
const Contest = require("../models/Contest");
const PlayerTeam = require("../models/PlayerTeam");
const FantasyTeam = require("../models/FantasyTeam");
const FantasyGame = require("../models/FantasyGame");
const Notification = require("../models/Notification");
const NotificationTemplate = require("../models/NotificationTemplate");
const EmailTemplate = require("../models/EmailTemplate");
const SocialLink = require("../models/SocialLink");
const Cms = require("../models/Cms");
const Faq = require("../models/Faq");
const Banner = require("../models/Banner");
const HowToPlay = require("../models/HowToPlay");
const KycVerification = require("../models/KycVerification");
const PaymentApproval = require("../models/PaymentApproval");
const Country = require("../models/Country");
const MatchPlayer = require("../models/MatchPlayer");
const PlayerStat = require("../models/PlayerStat");

const idMap = {
    users: {},
    admins: {},
    teams: {},
    players: {},
    tournaments: {},
    matches: {},
    contests: {},
    fantasy_teams: {},
    transactions: {},
};

async function migrate() {
    try {
        await connectDB();
        console.log("🚀 Starting migration...");

        // 0. Countries
        console.log("🌍 Migrating Countries...");
        const sqlCountries = await knex("sportmonks_country").select("*");
        for (const country of sqlCountries) {
            await Country.create({
                name: country.name,
                image_path: country.image_path,
                country_id: country.id,
                created_at: country.created_at,
                updated_at: country.updated_at,
            });
        }
        console.log(`✅ Migrated ${sqlCountries.length} countries`);

        // 1. Teams
        console.log("🛡️ Migrating Teams...");
        const sqlTeams = await knex("teams").select("*");
        for (const team of sqlTeams) {
            const mongoTeam = await Team.create({
                name: team.name,
                short_name: team.short_name,
                logo_url: team.logo_url,
                type: team.type,
                country_id: team.country_id,
                sportmonks_id: team.sportmonks_id,
                created_at: team.created_at,
                updated_at: team.updated_at,
            });
            idMap.teams[team.id] = mongoTeam._id;
        }
        console.log(`✅ Migrated ${sqlTeams.length} teams`);

        // 2. Players
        console.log("🏏 Migrating Players...");
        const sqlPlayers = await knex("players").select("*");
        for (const player of sqlPlayers) {
            const mongoPlayer = await Player.create({
                name: player.name,
                role: player.role,
                sportmonks_id: player.sportmonks_id,
                image_url: player.image_url,
                points: player.points || 0,
                credits: player.credits || 0,
                created_at: player.created_at,
                updated_at: player.updated_at,
            });
            idMap.players[player.id] = mongoPlayer._id;
        }
        console.log(`✅ Migrated ${sqlPlayers.length} players`);

        // 3. Tournaments
        console.log("🏆 Migrating Tournaments...");
        const sqlTournaments = await knex("tournaments").select("*");
        for (const tour of sqlTournaments) {
            const mongoTour = await Tournament.create({
                name: tour.name,
                sportmonks_id: tour.sportmonks_id,
                status: tour.status,
                created_at: tour.created_at,
                updated_at: tour.updated_at,
            });
            idMap.tournaments[tour.id] = mongoTour._id;
        }
        console.log(`✅ Migrated ${sqlTournaments.length} tournaments`);

        // 4. Users
        console.log("👥 Migrating Users...");
        const sqlUsers = await knex("users").select("*");
        for (const user of sqlUsers) {
            const mongoUser = await User.create({
                name: user.name,
                email: user.email,
                phone: user.phone,
                password: user.password,
                role: user.role || "user",
                wallet_balance: user.wallet_balance || 0,
                status: (user.status === true || user.status === 1) ? 1 : 0,
                ftoken: user.ftoken,
                google_id: user.google_id,
                social_login_type: user.social_login_type,
                device_id: user.device_id,
                device_type: user.device_type,
                is_name_setup: user.is_name_setup,
                is_verified: user.is_verified,
                referral_code: user.referral_code,
                referral_bonus: user.referral_bonus,
                otp: user.otp,
                otp_expires: user.otp_expires,
                created_at: user.created_at,
                updated_at: user.updated_at,
            });
            idMap.users[user.id] = mongoUser._id;
        }
        console.log(`✅ Migrated ${sqlUsers.length} users`);

        // 5. Matches
        console.log("🆚 Migrating Matches...");
        const sqlMatches = await knex("matches").select("*");
        for (const match of sqlMatches) {
            const mongoMatch = await Match.create({
                sportmonks_id: match.sportmonks_id,
                title: match.title,
                short_title: match.short_title,
                tournament: idMap.tournaments[match.tournament_id],
                team1: idMap.teams[match.team1_id],
                team2: idMap.teams[match.team2_id],
                start_time: match.start_time,
                status: match.status,
                format: match.format,
                venue_id: match.venue_id,
                toss_won_team_id: match.toss_won_team_id,
                toss_decision: match.toss_decision,
                score_team1: match.score_team1,
                score_team2: match.score_team2,
                overs_team1: match.overs_team1,
                overs_team2: match.overs_team2,
                winning_team_id: match.winning_team_id,
                man_of_the_match_id: match.man_of_the_match_id,
                result_note: match.result_note,
                created_at: match.created_at,
                updated_at: match.updated_at,
            });
            idMap.matches[match.id] = mongoMatch._id;
        }
        console.log(`✅ Migrated ${sqlMatches.length} matches`);

        // 6. Contests
        console.log("💰 Migrating Contests...");
        const sqlContests = await knex("contests").select("*");
        for (const contest of sqlContests) {
            const mongoContest = await Contest.create({
                name: contest.name,
                match: idMap.matches[contest.match_id],
                prize_pool: contest.prize_pool,
                entry_fee: contest.entry_fee,
                max_spots: contest.max_spots,
                filled_spots: contest.filled_spots || 0,
                contest_type: contest.type,
                status: contest.status,
                created_at: contest.created_at,
                updated_at: contest.updated_at,
            });
            idMap.contests[contest.id] = mongoContest._id;
        }
        console.log(`✅ Migrated ${sqlContests.length} contests`);

        // 7. Wallets
        console.log("💳 Migrating Wallets...");
        const sqlWallets = await knex("wallet").select("*");
        for (const wallet of sqlWallets) {
            await Wallet.create({
                user: idMap.users[wallet.user_id],
                balance: wallet.balance || 0,
                currency: wallet.currency || "BDT",
                created_at: wallet.created_at,
                updated_at: wallet.updated_at,
            });
        }
        console.log(`✅ Migrated ${sqlWallets.length} wallets`);

        // 8. Transactions
        console.log("💸 Migrating Transactions...");
        const sqlTrx = await knex("transactions").select("*");
        for (const trx of sqlTrx) {
            const mongoTrx = await Transaction.create({
                user: idMap.users[trx.user_id],
                title: trx.title || `Transaction - ${trx.transactionType}`,
                amount: trx.amount,
                currency: trx.currency || "BDT",
                status: trx.status,
                transactionType: trx.transactionType,
                metadata: {
                    payment_id: trx.payment_id,
                    trx_id: trx.trx_id,
                    merchant_invoice_number: trx.merchant_invoice_number,
                    contest_id_sql: trx.contest_id,
                },
                created_at: trx.created_at,
                updated_at: trx.updated_at,
            });
            idMap.transactions[trx.id] = mongoTrx._id;
        }
        console.log(`✅ Migrated ${sqlTrx.length} transactions`);

        // 9. Fantasy Teams
        console.log("🧙‍♂️ Migrating Fantasy Teams...");
        const sqlFT = await knex("fantasy_teams").select("*");
        for (const ft of sqlFT) {
            const ftPlayers = await knex("fantasy_team_players").where("fantasy_team_id", ft.id).select("*");
            const playersMapped = ftPlayers.map(p => ({
                player: idMap.players[p.player_id],
                is_captain: p.is_captain,
                is_vice_captain: p.is_vice_captain,
                is_substitute: p.is_substitute,
                points: p.points || 0
            }));

            const mongoFT = await FantasyTeam.create({
                user: idMap.users[ft.user_id],
                match: idMap.matches[ft.match_id],
                name: ft.name,
                players: playersMapped,
                total_points: ft.total_points || 0,
                created_at: ft.created_at,
                updated_at: ft.updated_at,
            });
            idMap.fantasy_teams[ft.id] = mongoFT._id;
        }
        console.log(`✅ Migrated ${sqlFT.length} fantasy teams`);

        // 10. Fantasy Games (Contest entries)
        console.log("🎮 Migrating Fantasy Games...");
        const sqlFG = await knex("fantasy_games").select("*");
        for (const fg of sqlFG) {
            await FantasyGame.create({
                user: idMap.users[fg.user_id],
                contest: idMap.contests[fg.contest_id],
                fantasy_team: idMap.fantasy_teams[fg.fantasy_team_id],
                rank: fg.rank,
                points: fg.points || 0,
                winnings: fg.winnings || 0,
                created_at: fg.created_at,
                updated_at: fg.updated_at,
            });
        }
        console.log(`✅ Migrated ${sqlFG.length} fantasy games`);

        // 11. Match Players (Lineups)
        console.log("📋 Migrating Match Players...");
        const sqlMatchPlayers = await knex("match_players").select("*");
        for (const mp of sqlMatchPlayers) {
            await MatchPlayer.create({
                match: idMap.matches[mp.match_id],
                player: idMap.players[mp.player_id],
                team: idMap.teams[mp.team_id],
                is_playing_xi: mp.is_playing_xi,
                is_substitute: mp.is_substitute,
                role: mp.role,
                created_at: mp.created_at,
                updated_at: mp.updated_at,
            });
        }
        console.log(`✅ Migrated ${sqlMatchPlayers.length} match players`);

        // 12. Player Match Statistics
        console.log("📊 Migrating Player Match Statistics...");
        const sqlPlayerStats = await knex("player_match_statistics").select("*");
        for (const ps of sqlPlayerStats) {
            await PlayerStat.create({
                match: idMap.matches[ps.match_id],
                player: idMap.players[ps.player_id],
                fantasy_points: ps.points || 0,
                runs_scored: ps.runs || 0,
                wickets: ps.wickets || 0,
                catches: ps.catches || 0,
                stumpings: ps.stumpings || 0,
                run_outs: ps.run_outs || 0,
                fours: ps.fours || 0,
                sixes: ps.sixes || 0,
                overs: ps.overs || 0,
                maiden_overs: ps.maiden_overs || 0,
                economy: ps.economy || 0,
                is_duck: ps.is_duck || false,
                batting_status: ps.batting_status,
                bowling_status: ps.bowling_status,
                created_at: ps.created_at,
                updated_at: ps.updated_at,
            });
        }
        console.log(`✅ Migrated ${sqlPlayerStats.length} player stats`);

        // 13. Update User Referrals
        console.log("🔗 Updating User Referrals...");
        for (const user of sqlUsers) {
            if (user.referred_by && idMap.users[user.referred_by]) {
                await User.findByIdAndUpdate(idMap.users[user.id], { referred_by: idMap.users[user.referred_by] });
            }
        }

        // 14. Static Content
        console.log("📄 Migrating Static Content...");
        const sqlCMS = await knex("cms").select("*");
        for (const cms of sqlCMS) await Cms.create(cms);
        const sqlFaqs = await knex("faqs").select("*");
        for (const faq of sqlFaqs) await Faq.create(faq);
        const sqlBanners = await knex("banners").select("*");
        for (const banner of sqlBanners) await Banner.create(banner);
        const sqlNT = await knex("notification_templates").select("*");
        for (const nt of sqlNT) await NotificationTemplate.create(nt);
        const sqlET = await knex("email_templates").select("*");
        for (const et of sqlET) await EmailTemplate.create(et);
        const sqlHTP = await knex("how_to_play").select("*");
        for (const htp of sqlHTP) await HowToPlay.create(htp);

        console.log("✨ Migration completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
}

migrate();
