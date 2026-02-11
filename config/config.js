require("dotenv").config();

module.exports = {
  env: process.env.NODE_ENV || "development",
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpirationInterval: process.env.JWT_EXPIRATION_MINUTES || "1440", // 24 hours

  // Database configuration
  database: {
    client: "pg",
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
    pool: {
      min: 2,
      max: 20,
    },
    migrations: {
      tableName: "knex_migrations",
      directory: "./database/migrations",
    },
    seeds: {
      directory: "./database/seeds",
    },
  },

  baseURL: process.env.BASE_URL || "http://localhost:3000",

  Bkash: {
    bkash_grant_token_url:
      process.env.bkash_grant_token_url ||
      "https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/token/grant",
    refresh_token_url:
      "https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/token/refresh",
    bkash_create_payment_url:
      process.env.bkash_create_payment_url ||
      "https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/create",
    bkash_execute_payment_url:
      process.env.bkash_execute_payment_url ||
      "https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/execute",
    backend_callback_url:
      "http://localhost:3000/api/user/wallet/payment/callback",
    frontend_success_url: "http://localhost:3000/payment-success",
    frontend_fail_url: "http://localhost:3000/payment-fail",
    bkash_username: process.env.bkash_username || "sandboxTokenizedUser02",
    bkash_password:
      process.env.bkash_password || "sandboxTokenizedUser02@12345",
    bkash_api_key: process.env.bkash_api_key || "4f6o0cjiki2rfm34kfdadl1eqq",
    bkash_secret_key:
      process.env.bkash_secret_key ||
      "2is7hdktrekvrbljjh44ll3d9l1dtjo4pasmjvs5vl5qr3fug4b",
  },
  BkashDisbursement: {
    grant_token_url: process.env.bkash_disbursement_grant_token_url,
    disburse_url: process.env.bkash_disbursement_disburse_url,
    app_key: process.env.bkash_disbursement_app_key,
    app_secret: process.env.bkash_disbursement_app_secret,
    username: process.env.bkash_disbursement_username,
    password: process.env.bkash_disbursement_password,
    access_key: process.env.bkash_disbursement_access_key, // you need to add this
    secret_access_key: process.env.bkash_disbursement_secret_key, // you need to add this
    aws_region: process.env.bkash_disbursement_aws_region || "ap-southeast-1",
  },
  apay: {
    apay_deposit:8,
    apay_deposit_custom:2,

    apay_withdraw:3,
    apay_withdraw_custom:15,

    base_url: process.env.APAY_BASE_URL || "https://pay-crm.com",
    api_key: process.env.APAY_API_KEY || "e0c47d328612aab08dc54900c3f9126b",
    project_id: process.env.APAY_PROJECT_ID || 6963636,
    access_key:
      process.env.APAY_ACCESS_KEY || "1b45e94b3b862335c46cd28f5ff78f50",
    private_key:
      process.env.APAY_PRIVATE_KEY || "fa560187b8a73a1974a3f9c53b2ac30b",
    webhook_url:
      process.env.APAY_WEBHOOK_URL ||
      "https://my-best11-api.devtechnosys.tech/api/user/apay/webhook",
    return_url:
      process.env.APAY_RETURN_URL ||
      "https://my-best11-api.devtechnosys.tech/api/user/apay/payment-callback",
    webhook_deposit_url:
      process.env.APAY_WEBHOOK_DEPOSIT_URL ||
      "https://my-best11-api.devtechnosys.tech/api/user/apay/webhook/deposit",
    webhook_withdrawal_url:
      process.env.APAY_WEBHOOK_WITHDRAWAL_URL ||
      "https://my-best11-api.devtechnosys.tech/api/user/apay/webhook/withdrawal",
    webhook_id: process.env.APAY_WEBHOOK_ID || 6189686,
    deep_link_scheme: process.env.APP_DEEP_LINK_SCHEME,
    account_email: process.env.APAY_ACCOUNT_EMAIL || "prantobkash@gmail.com",

    backend_url:
      process.env.BACKEND_URL || "https://my-best11-api.devtechnosys.tech",
    frontend_url: process.env.FRONTEND_URL || "http://localhost:3000",
    payment_callback_path: "/api/user/apay/payment-callback",
  },

  laffic: {
    api_key: process.env.LAFFIC_API_KEY,
    api_secret: process.env.LAFFIC_SECRET_KEY,
    appid: process.env.LAFFIC_APP_ID,
    senderId: process.env.LAFFIC_SENDER_ID,
  },

  // Email configuration
  email: {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE || true,
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || "noreply@fantasycricket.com",
  },

  // Application URLs
  appUrl: process.env.APP_URL || "http://localhost:3000",
  clientUrl: process.env.CLIENT_URL || "http://localhost:3001",

  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5000, // limit each IP to 100 requests per windowMs
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || "info",
    file: process.env.LOG_FILE || "logs/app.log",
  },

  goalserve: {
    baseUrl: "https://api.goalserve.com/getjson",
    apiKey: process.env.CRICKET_API_KEY,
  },

  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3001",
  },
};
