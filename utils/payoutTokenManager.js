const axios = require("axios");
const config = require("../config/config");

let payoutToken = null;
let refreshToken = null;
let tokenIssuedAt = null;

const isTokenExpired = () => {
  if (!tokenIssuedAt) return true;
  const now = Date.now();
  return now - tokenIssuedAt > 3600 * 1000; // 1 hour
};

const getPayoutToken = async () => {
  if (payoutToken && !isTokenExpired()) return payoutToken;

  const headers = {
    Accept: "application/json",
    username: config.BkashDisbursement.username,
    password: config.BkashDisbursement.password,
    "Content-Type": "application/json",
  };

  const body = {
    app_key: config.BkashDisbursement.app_key,
    app_secret: config.BkashDisbursement.app_secret,
  };

  try {
    const { data } = await axios.post(
      config.BkashDisbursement.grant_token_url,
      body,
      { headers }
    );
    payoutToken = data.id_token;
    refreshToken = data.refresh_token;
    tokenIssuedAt = Date.now();
    return payoutToken;
  } catch (err) {
    console.error("Grant Token Error:", err.response?.data || err.message);
    throw err;
  }
};

module.exports = { getPayoutToken };
