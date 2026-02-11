const crypto = require("crypto");

class APayHelper {
  static generateSignature(accessKey, privateKey, transactionsJson) {
    const md5Hash = crypto
      .createHash("md5")
      .update(transactionsJson)
      .digest("hex");
    const signatureString = accessKey + privateKey + md5Hash;
    return crypto.createHash("sha1").update(signatureString).digest("hex");
  }

  static verifyWebhookSignature(
    accessKey,
    privateKey,
    transactions,
    receivedSignature
  ) {
    const transactionsJson = JSON.stringify(transactions);
    const md5Hash = crypto
      .createHash("md5")
      .update(transactionsJson)
      .digest("hex");
    const signatureString = accessKey + privateKey + md5Hash;
    const calculatedSignature = crypto
      .createHash("sha1")
      .update(signatureString)
      .digest("hex");
    return calculatedSignature === receivedSignature;
  }

  static formatPaymentSystemData(paymentSystem, phoneNumber, returnUrl, email) {
    switch (paymentSystem) {
      case "bkash_b":
        return {
          return_url: returnUrl,
          account_number: phoneNumber,
          account_email: email,
        };
      case "bkash_a":
        return {
          return_url: returnUrl,
          phone_number: phoneNumber,
        };
      case "nagad_b":
      case "nagad_a":
        return {
          return_url: returnUrl,
          phone_number: phoneNumber,
        };
      case "upay":
        return {
          return_url: returnUrl,
          phone_number: phoneNumber,
        };
      
      default:
        return { 
          return_url: returnUrl,
          phone_number: phoneNumber 
        };
    }
  }

  // Helper method to format data for multiple payment systems
  static formatDataForMultiplePaymentSystems(paymentSystems, phoneNumber, returnUrl, email) {
    // Get data for all payment systems
    const allData = paymentSystems.map(ps => 
      this.formatPaymentSystemData(ps, phoneNumber, returnUrl, email)
    );

    // Merge all data, prioritizing common fields
    const mergedData = {
      return_url: returnUrl,
      phone_number: phoneNumber,
      account_number: phoneNumber,
    };

    // Add email if any system needs it
    if (email) {
      mergedData.account_email = email;
    }

    // Add any additional fields that might be needed
    allData.forEach(data => {
      Object.keys(data).forEach(key => {
        if (data[key] && !mergedData[key]) {
          mergedData[key] = data[key];
        }
      });
    });

    return mergedData;
  }
}

module.exports = APayHelper;
