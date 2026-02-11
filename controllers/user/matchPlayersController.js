const MatchPlayers = require('../models/match_players');
const apiResponse = require("../../utils/apiResponse");
const { slugGenrator, listing } = require("../../utils/functions");
const { ERROR, USER, SUCCESS } = require("../../utils/responseMsg");

exports.createMatchPlayer = async (req, res) => {
  try {
    const { match_id, player_id, is_playing_xi, is_substitute } = req.body;
    const matchPlayer = await MatchPlayers.create({ match_id, player_id, is_playing_xi, is_substitute });
    res.status(201).json(matchPlayer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getMatchPlayersByMatch = async (req, res) => {
  try {
    const matchPlayers = await MatchPlayers.findByMatch(req.params.match_id);
    res.json(matchPlayers);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getMatchPlayersByPlayer = async (req, res) => {
  try {
    const matchPlayers = await MatchPlayers.findByPlayer(req.params.player_id);
    res.json(matchPlayers);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};