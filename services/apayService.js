const axios = require("axios");
const APayHelper = require("../utils/apayHelper");
const config = require("../config/config");

class APayService {
  constructor() {
    this.baseURL = config.apay.base_url;
    this.apiKey = config.apay.api_key;
    this.projectId = config.apay.project_id;
    this.webhookUrl = config.apay.webhook_url;
    this.returnUrl = `${config.apay.backend_url}${config.apay.payment_callback_path}`;
  }

  createAxiosInstance() {
    return axios.create({
      baseURL: this.baseURL,
      headers: {
        "Content-Type": "application/json",
        apikey: this.apiKey,
      },
    });
  }
//! get payment system whgich is available
  async getPaymentSystems() {
    try {
      const api = this.createAxiosInstance();
      const response = await api.get("/Remotes/payment-systems-info", {
        params: { project_id: this.projectId },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get payment systems: ${error.message}`);
    }
  }

//! create payment page
  async createPaymentPage({
    amount,
    paymentSystem,
    customUserId,
    phoneNumber,
    currency = "BDT",
    customTransactionId,
    buttons = [] ,
    language = ["BN","EN"] ,
    email
  }) {
    try {
      const api = this.createAxiosInstance();

      const returnUrl = `${this.returnUrl}?custom_transaction_id=${customTransactionId}`;

      const payload = {
        amount: Math.floor(amount),
        currency,
        buttons,
        payment_system: paymentSystem,
        custom_transaction_id: customTransactionId,
        custom_user_id: customUserId,
        language,
        return_url: returnUrl,
        webhook_id: config.apay.webhook_id || null,
        webhook_url: config.apay.webhook_deposit_url,
        data: this.formatPaymentSystemDataForMultiple(
          paymentSystem,
          phoneNumber,
          returnUrl,
          email
        ),
      };

     

      const response = await api.post("/Remotes/create-payment-page", payload, {
        params: { project_id: this.projectId },
      });

      return response.data;
    } catch (error) {
      console.error("APay createPaymentPage Error Response:", error.response?.data);
      throw new Error(
        `Failed to create payment page: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  async createDeposit({
    amount,
    currency = "BDT",
    paymentSystem = "bkash_b",
    customUserId,
    phoneNumber,
    customTransactionId = null,
  }) {
    try {
      const api = this.createAxiosInstance();

      const returnUrl = `${this.returnUrl}?custom_transaction_id=${customTransactionId}`;

      const payload = {
        amount,
        currency,
        payment_system: paymentSystem,
        custom_transaction_id: customTransactionId,
        custom_user_id: customUserId,
        webhook_id: config.apay.webhook_id || null,
        webhook_url: config.apay.webhook_deposit_url,
        data: APayHelper.formatPaymentSystemData(
          paymentSystem,
          phoneNumber,
          returnUrl
        ),
      };
    
      const response = await api.post("/Remotes/create-deposit", payload, {
        params: { project_id: this.projectId },
      });
      if (response.data?.success) {
        const actualReturnUrl = returnUrl.replace(
          "ORDER_ID_PLACEHOLDER",
          response.data.order_id
        );

        if (response.data.data?.paymentpage_url) {
          response.data.data.paymentpage_url =
            response.data.data.paymentpage_url.replace(
              /return_url=[^&]*/,
              `return_url=${encodeURIComponent(actualReturnUrl)}`
            );
        }

        response.data.return_url = actualReturnUrl;
      }
      return response.data;
    } catch (error) {
      console.error("APay createDeposit Error Response:", error.response?.data);
      throw new Error(
        `Failed to create deposit: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  async createWithdrawal({
    amount,
    currency = "BDT",
    paymentSystem,
    customUserId,
    phoneNumber,
    customTransactionId,
    email,
    
  }) {
 
    try {
      const validPaymentSystems = ["bkash_b", "nagad_b", "upay"];
    if (!validPaymentSystems.includes(paymentSystem)) {
      throw new Error(`Invalid payment system. Supported: ${validPaymentSystems.join(", ")}`);
    }
      const api = this.createAxiosInstance();
      let data = {};
if (paymentSystem === "bkash_b") {
  data = {
    account_email: email,
    account_number: String(phoneNumber)
  };
} else if (paymentSystem === "upay") {
  data = {
    account_email: email,
    account_number: String(phoneNumber)
  };
} else if (paymentSystem === "nagad_b") {
  data = {
    account_number: String(phoneNumber)
  };
}

      const payload = {
        amount: Math.floor(amount),
        currency,
        payment_system: paymentSystem,
        custom_transaction_id: customTransactionId,
        custom_user_id: customUserId,
        webhook_id: config.apay.webhook_id,
        webhook_url: config.apay.webhook_withdrawal_url,
        data
      };

    

      const response = await api.post("/Remotes/create-withdrawal", payload, {
        params: { project_id: this.projectId },
      });
     
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to create withdrawal: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  async activateDeposit(
    orderId,
    paymentSystem = "bkash_a",
    additionalData = {}
  ) {
    try {
      const api = this.createAxiosInstance();
      let returnUrlForActivate = this.returnUrl;

      if (additionalData.return_url) {
        returnUrlForActivate = additionalData.return_url;
      }

      let payloadData;
      if (paymentSystem === "bkash_a") {
        payloadData = {
          return_url: returnUrlForActivate,
          account_number: additionalData.phone || additionalData.account_number,
        };
      } else {
        payloadData = APayHelper.formatPaymentSystemData(
          paymentSystem,
          additionalData,
          returnUrlForActivate
        );
      }

      const payload = {
        payment_system: paymentSystem,
        data: payloadData,
      };

    

      const response = await api.post("/Remotes/deposit-activate", payload, {
        params: { project_id: this.projectId, order_id: orderId },
      });

      return response.data;
    } catch (error) {
      console.error(
        "APay activateDeposit Error Response:",
        error.response?.data
      );
      throw new Error(
        `Failed to activate deposit: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }
  async getDepositInfo(orderId) {
    try {
      const api = this.createAxiosInstance();

      const response = await api.get("/Remotes/deposit-info", {
        params: { project_id: this.projectId, order_id: orderId },
      });

   

      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get deposit info: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  async getWithdrawalInfo(orderId) {
    try {
      const api = this.createAxiosInstance();

      const response = await api.get("/Remotes/withdrawal-info", {
        params: { project_id: this.projectId, order_id: orderId },
      });
  

      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get withdrawal info: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  async createLostTransaction({
    orderId = null,
    customTransactionId = null,
    description = null,
    file = null,
  }) {
    try {
      const api = this.createAxiosInstance();

      const formData = new FormData();
      if (file) formData.append("file", file);
      if (orderId) formData.append("order_id", orderId);
      if (customTransactionId)
        formData.append("custom_transaction_id", customTransactionId);
      if (description) formData.append("description", description);

      const response = await api.post(
        "/Remotes/create-lost-transaction",
        formData,
        {
          params: { project_id: this.projectId },
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to create lost transaction: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  async getLostTransactionInfo(orderId = null, customTransactionId = null) {
    try {
      const api = this.createAxiosInstance();

      const params = { project_id: this.projectId };
      if (orderId) params.order_id = orderId;
      if (customTransactionId)
        params.custom_transaction_id = customTransactionId;

      const response = await api.get("/Remotes/lost-transaction-info", {
        params,
      });

      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get lost transaction info: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  // Helper method to format payment system data for multiple payment systems
  formatPaymentSystemDataForMultiple(paymentSystems, phoneNumber, returnUrl,email) {

    return APayHelper.formatDataForMultiplePaymentSystems(
      paymentSystems,
      phoneNumber,
      returnUrl,
      email
    );
  }
}

module.exports = APayService;
