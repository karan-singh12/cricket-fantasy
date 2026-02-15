async function updateLeaderboardForTodayMatches(db) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const matches = await db("matches").whereRaw("DATE(start_time) = ?", [
    todayStr,
  ]);

  for (const match of matches) {
    const matchId = match.id;
    const matchType = match.match_type?.toLowerCase();

    const fantasyTeams = await db("fantasy_teams as ft")
      .join("fantasy_games as fg", "ft.id", "fg.fantasy_team_id")
      .where("ft.match_id", matchId)
      .select(
        "ft.id as team_id",
        "ft.match_id",
        "ft.user_id",
        "fg.id as fantasy_game_id",
        "fg.contest_id",
        "fg.user_id as game_user_id"
      );


    console.log(`Found ${fantasyTeams.length} fantasy teams for match ${matchId}`);

    // Get fantasy points rules
    const fantasyPointsRules = await db("fantasy_points").select("*");

    if (!fantasyPointsRules.length) {
      console.log("No fantasy points rules found, skipping point calculation");
      continue;
    }

    // Get player match statistics
    const allPlayerStats = await db("player_match_statistics").where({
      match_id: matchId,
    });

    if (!allPlayerStats.length) {
      console.log(`No player match statistics found for match ${matchId}, skipping`);
      continue;
    }

    // Helper function to get points by score_id
    function calculateFantasyPointsByScoreId(scoreId, matchType) {
      const rule = fantasyPointsRules.find((fp) => fp.score_id === scoreId);
      if (!rule) return 0;
      return getPoints(rule, matchType);
    }

    for (const team of fantasyTeams) {

      const teamPlayers = await db("fantasy_team_players").where({
        fantasy_team_id: team.team_id,
      });

      if (!teamPlayers.length) continue;

      const captainRow = teamPlayers.find((p) => p.is_captain === true);

      const viceCaptainRow = teamPlayers.find(
        (p) => p.is_vice_captain === true
      );

      const captainId = captainRow?.player_id;
      const viceCaptainId = viceCaptainRow?.player_id;

      // Filter stats for players in this fantasy team
      const teamPlayerStats = allPlayerStats.filter((stat) =>
        teamPlayers.some((tp) => tp.player_id === stat.player_id)
      );

      let totalScore = 0;

      // Calculate points for each player in the team
      for (const stat of teamPlayerStats) {

        const playerRow = teamPlayers.find((tp) => tp.player_id === stat.player_id);
        if (playerRow?.substitute == true) {
          console.log(`Skipping substitute player ${stat.player_id}`);
          continue;
        }

        let playerPoints = 0;
        // BATTING POINTS
        // 1. Runs - Each run gives points based on match type
        if (stat.runs > 0) {
          playerPoints += calculateFantasyPointsByScoreId(5000, matchType) * stat.runs;
        }
        // 2. Fours - Each boundary (4) gives points
        if (stat.fours > 0) {
          playerPoints += calculateFantasyPointsByScoreId(5001, matchType) * stat.fours;
        }
        // 3. Sixes - Each six gives points
        if (stat.sixes > 0) {
          playerPoints += calculateFantasyPointsByScoreId(5002, matchType) * stat.sixes;
        }
        // 4-10. Batting milestone bonuses
        if (stat.runs >= 25) playerPoints += calculateFantasyPointsByScoreId(5003, matchType);
        if (stat.runs >= 50) playerPoints += calculateFantasyPointsByScoreId(5004, matchType);
        if (stat.runs >= 75) playerPoints += calculateFantasyPointsByScoreId(5005, matchType);
        if (stat.runs >= 100) playerPoints += calculateFantasyPointsByScoreId(5006, matchType);
        if (stat.runs >= 125) playerPoints += calculateFantasyPointsByScoreId(5007, matchType);
        if (stat.runs >= 150) playerPoints += calculateFantasyPointsByScoreId(5008, matchType);
        if (stat.runs >= 200) playerPoints += calculateFantasyPointsByScoreId(5009, matchType);
        // BOWLING POINTS
        // 11. Each wicket gives points
        if (stat.wickets > 0) {
          playerPoints += calculateFantasyPointsByScoreId(5010, matchType) * stat.wickets;
        }
        // 12. Maiden overs
        if (stat.maidens > 0) {
          playerPoints += calculateFantasyPointsByScoreId(5013, matchType) * stat.maidens;
        }
        // 13-17. Bowling milestone bonuses
        if (stat.wickets >= 2) playerPoints += calculateFantasyPointsByScoreId(5014, matchType);
        if (stat.wickets >= 3) playerPoints += calculateFantasyPointsByScoreId(5015, matchType);
        if (stat.wickets >= 4) playerPoints += calculateFantasyPointsByScoreId(5016, matchType);
        if (stat.wickets >= 5) playerPoints += calculateFantasyPointsByScoreId(5017, matchType);
        if (stat.wickets >= 6) playerPoints += calculateFantasyPointsByScoreId(5018, matchType);
        if (stat.wickets >= 8) playerPoints += calculateFantasyPointsByScoreId(5019, matchType);
        // FIELDING POINTS
        // 18. Catches - Each catch gives points
        if (stat.catches > 0) {
          playerPoints += calculateFantasyPointsByScoreId(5020, matchType) * stat.catches;
        }
        // 19. 3 Catches Bonus
        if (stat.catches >= 3) {
          playerPoints += calculateFantasyPointsByScoreId(5021, matchType);
        }
        // 20. 5 Catches Bonus
        if (stat.catches >= 5) {
          playerPoints += calculateFantasyPointsByScoreId(5022, matchType);
        }
        // 21. Stumpings - Each stumping gives points
        if (stat.stumpings > 0) {
          playerPoints += calculateFantasyPointsByScoreId(5023, matchType) * stat.stumpings;
        }
        // 22. Run Outs - Direct Hit
        if (stat.run_outs_direct_hit > 0) {
          playerPoints += calculateFantasyPointsByScoreId(5024, matchType) * stat.run_outs_direct_hit;
        }
        // 23. Run Outs - Assisted
        if (stat.run_outs > 0) {
          playerPoints += calculateFantasyPointsByScoreId(5025, matchType) * stat.run_outs;
        }

        // 24. dot balls
        if (stat.dot_ball > 0) {
          playerPoints += calculateFantasyPointsByScoreId(5012, matchType) * stat.dot_ball;
        }

        // 25. 2 dot balls
        if (stat.dot_ball2 > 0) {
          playerPoints += calculateFantasyPointsByScoreId(5011, matchType) * stat.dot_ball2;
        }
        
        if (stat.balls_faced >= 10 && stat.runs > 0) {
          const strikeRate = (stat.runs / stat.balls_faced) * 100;
          let srPoints = 0;

          if (strikeRate < 50) {
            srPoints = calculateFantasyPointsByScoreId(5026, matchType);
          } else if (strikeRate < 60) {
            srPoints = calculateFantasyPointsByScoreId(5027, matchType);
          } else if (strikeRate < 70) {
            srPoints = calculateFantasyPointsByScoreId(5028, matchType);
          } else if (strikeRate >= 100 && strikeRate < 120) {
            srPoints = calculateFantasyPointsByScoreId(5029, matchType);
          } else if (strikeRate >= 120 && strikeRate < 150) {
            srPoints = calculateFantasyPointsByScoreId(5030, matchType);
          } else if (strikeRate >= 150) {
            srPoints = calculateFantasyPointsByScoreId(5031, matchType);
          }

          if (srPoints !== 0) {
            playerPoints += srPoints;
            console.log(`📊 Strike Rate: ${strikeRate.toFixed(2)} → ${srPoints} pts`);
          }
        }

        if (stat.overs >= 2) {
          const economy = stat.runs_conceded / stat.overs;
          let ecoPoints = 0;

          if (economy < 5) {
            ecoPoints = calculateFantasyPointsByScoreId(5032, matchType);
          } else if (economy < 6) {
            ecoPoints = calculateFantasyPointsByScoreId(5033, matchType);
          } else if (economy < 7) {
            ecoPoints = calculateFantasyPointsByScoreId(5034, matchType);
          } else if (economy >= 10 && economy < 11) {
            ecoPoints = calculateFantasyPointsByScoreId(5035, matchType);
          } else if (economy >= 11 && economy < 12) {
            ecoPoints = calculateFantasyPointsByScoreId(5036, matchType);
          } else if (economy >= 12) {
            ecoPoints = calculateFantasyPointsByScoreId(5037, matchType);
          }

          if (ecoPoints !== 0) {
            playerPoints += ecoPoints;
            console.log(`📊 Economy: ${economy.toFixed(2)} → ${ecoPoints} pts`);
          }
        }

        // Captain / Vice Captain multiplier
        let multiplier = 1;
        if (stat.player_id === captainId) multiplier = 2;
        else if (stat.player_id === viceCaptainId) multiplier = 1.5;

        const finalPlayerPoints = playerPoints * multiplier;

        console.log(`Player ${stat.player_id}: ${playerPoints} points (×${multiplier}) = ${finalPlayerPoints}`);

        // Update fantasy_team_players
        await db("fantasy_team_players")
          .where({ fantasy_team_id: team.team_id, player_id: stat.player_id })
          .update({ points: finalPlayerPoints, updated_at: new Date() });

        totalScore += finalPlayerPoints;
      }

      console.log(`Match ${matchId} | User ${team.user_id} | Total Points = ${totalScore}`
      );
      // === Update leaderboard (per fantasyGameId) ===
      const leaderboardExists = await db("leaderboard")
        .where({ fantasyGameId: team.fantasy_game_id })
        .first();

      if (leaderboardExists) {
        await db("leaderboard")
          .where({ fantasyGameId: team.fantasy_game_id })
          .update({ totalScore, modified_at: new Date() });
      } else {
        await db("leaderboard").insert({
          matchId,
          contestId: team.contest_id,
          userId: team.user_id,
          fantasyGameId: team.fantasy_game_id,
          totalScore,
          created_at: new Date(),
          modified_at: new Date(),
        });
      }

      // Update fantasy team
      await db("fantasy_teams")
        .where({ id: team.team_id })
        .update({
          total_points: isNaN(totalScore) ? 0 : totalScore,
          updated_at: new Date(),
        });

      await db("fantasy_games")
        .where({ fantasy_team_id: team.team_id, user_id: team.user_id })
        .update({ points: totalScore, updated_at: new Date() });

    }

    await updateRanksForMatch(db, matchId);
  }

  return { success: true };
}

// Helper function to get points based on match type
function getPoints(rule, matchType) {
  const safe = (val) => (typeof val === "number" && !isNaN(val) ? val : 0);
  switch (matchType) {
    case "t20":
    case "t20i":
    case "100-ball":
      return safe(rule.points_t20);
    case "odi":
    case "youth odi":
    case "list a":
      return safe(rule.points_odi);
    case "test":
    case "test/5day":
    case "4day":
      return safe(rule.points_test);
    case "t10":
      return safe(rule.points_t10);
    default:
      return safe(rule.points_t20); // Default to T20 points
  }
}

// to update ranks
async function updateRanksForMatch(db, matchId) {
  const entries = await db("leaderboard")
    .where({ matchId: matchId })
    .orderBy("totalScore", "desc");

  let rank = 1;
  for (const entry of entries) {
    await db("leaderboard")
      .where({ id: entry.id })
      .update({ rank, modified_at: new Date() });
    rank += 1;
  }
}

module.exports = {
  updateLeaderboardForTodayMatches,
};



// // Update individual player stats for all players in the match
// for (const stat of allPlayerStats) {
//   let playerPoints = 0;

//   // Calculate points for individual player (same logic as above)
//   // BATTING POINTS
//   if (stat.runs > 0) {
//     playerPoints +=
//       calculateFantasyPointsByScoreId(5000, matchType) * stat.runs;
//   }
//   if (stat.fours > 0) {
//     playerPoints +=
//       calculateFantasyPointsByScoreId(5001, matchType) * stat.fours;
//   }
//   if (stat.sixes > 0) {
//     playerPoints +=
//       calculateFantasyPointsByScoreId(5002, matchType) * stat.sixes;
//   }

//   // Batting bonuses
//   if (stat.runs >= 25)
//     playerPoints += calculateFantasyPointsByScoreId(5003, matchType);
//   if (stat.runs >= 50)
//     playerPoints += calculateFantasyPointsByScoreId(5004, matchType);
//   if (stat.runs >= 75)
//     playerPoints += calculateFantasyPointsByScoreId(5005, matchType);
//   if (stat.runs >= 100)
//     playerPoints += calculateFantasyPointsByScoreId(5006, matchType);
//   if (stat.runs >= 125)
//     playerPoints += calculateFantasyPointsByScoreId(5007, matchType);
//   if (stat.runs >= 150)
//     playerPoints += calculateFantasyPointsByScoreId(5008, matchType);
//   if (stat.runs >= 200)
//     playerPoints += calculateFantasyPointsByScoreId(5009, matchType);

//   // BOWLING POINTS
//   if (stat.wickets > 0) {
//     playerPoints +=
//       calculateFantasyPointsByScoreId(5010, matchType) * stat.wickets;
//   }
//   if (stat.maidens > 0) {
//     playerPoints +=
//       calculateFantasyPointsByScoreId(5013, matchType) * stat.maidens;
//   }

//   // Bowling bonuses
//   if (stat.wickets >= 2)
//     playerPoints += calculateFantasyPointsByScoreId(5014, matchType);
//   if (stat.wickets >= 3)
//     playerPoints += calculateFantasyPointsByScoreId(5015, matchType);
//   if (stat.wickets >= 4)
//     playerPoints += calculateFantasyPointsByScoreId(5016, matchType);
//   if (stat.wickets >= 5)
//     playerPoints += calculateFantasyPointsByScoreId(5017, matchType);
//   if (stat.wickets >= 6)
//     playerPoints += calculateFantasyPointsByScoreId(5018, matchType);
//   if (stat.wickets >= 8)
//     playerPoints += calculateFantasyPointsByScoreId(5019, matchType);

//   // FIELDING POINTS
//   if (stat.catches > 0) {
//     playerPoints +=
//       calculateFantasyPointsByScoreId(5020, matchType) * stat.catches;
//   }
//   if (stat.catches >= 3) {
//     playerPoints += calculateFantasyPointsByScoreId(5021, matchType);
//   }
//   if (stat.catches >= 5) {
//     playerPoints += calculateFantasyPointsByScoreId(5022, matchType);
//   }
//   if (stat.stumpings > 0) {
//     playerPoints +=
//       calculateFantasyPointsByScoreId(5023, matchType) * stat.stumpings;
//   }
//   if (stat.run_outs_direct_hit > 0) {
//     playerPoints +=
//       calculateFantasyPointsByScoreId(5024, matchType) *
//       stat.run_outs_direct_hit;
//   }
//   if (stat.run_outs > 0) {
//     playerPoints +=
//       calculateFantasyPointsByScoreId(5025, matchType) * stat.run_outs;
//   }

//   console.log(
//     `Player ${stat.player_id} individual points: ${playerPoints}`
//   );

//   // Upsert player stats
//   const existingPlayerStat = await db("player_stats")
//     .where({ player_id: stat.player_id, match_id: matchId })
//     .first();

//   if (existingPlayerStat) {
//     await db("player_stats")
//       .where({ player_id: stat.player_id, match_id: matchId })
//       .update({
//         fantasy_points: playerPoints,
//         updated_at: new Date(),
//       });
//   } else {
//     await db("player_stats").insert({
//       player_id: stat.player_id,
//       match_id: matchId,
//       fantasy_points: playerPoints,
//       created_at: new Date(),
//       updated_at: new Date(),
//     });
//   }
// }



// // Update leaderboard
// const leaderboardExists = await db("leaderboard")
//   .where({ matchId, userId: team.user_id })
//   .first();

// if (leaderboardExists) {
//   await db("leaderboard")
//     .where({ matchId, userId: team.user_id })
//     .update({ totalScore, modified_at: new Date() });
// } else {
//   await db("leaderboard").insert({
//     matchId,
//     userId: team.user_id,
//     totalScore,
//     created_at: new Date(),
//     modified_at: new Date(),
//   });
// }
