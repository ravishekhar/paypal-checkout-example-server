// add a ".env" file to your project to set these environment variables
import { INTENT } from "@paypal/paypal-js";
import * as dotenv from "dotenv";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const {
  PAYPAL_ENVIRONMENT_MODE,
  PAYPAL_SANDBOX_CLIENT_ID,
  PAYPAL_SANDBOX_CLIENT_SECRET,
  PAYPAL_LIVE_CLIENT_ID,
  PAYPAL_LIVE_CLIENT_SECRET,
  PAYPAL_CURRENCY,
  PAYPAL_INTENT,
  PAYPAL_API_BASE_URL,
  PAYPAL_WEB_BASE_URL,
  DEPLOYMENT_ENV_BASE_URL,
  PAYPAL_ENABLE_SHIPPING_ADDRESS_CALLBACK,
  PAYPAL_ENABLE_SHIPPING_OPTIONS_CALLBACK,
  PAYPAL_DEMO_SHIPPING_EMAIL,
  PAYPAL_DEMO_SHIPPING_PHONE,
  PAYPAL_DEMO_SHIPPING_COUNTRY_CODE,
} = process.env;

function getConfig() {
  const env = PAYPAL_ENVIRONMENT_MODE?.toLowerCase() || "sandbox";
  return {
    paypal: {
      environment: env,
      enableOrderCapture: env === "sandbox",
      clientID:
        env === "sandbox" ? PAYPAL_SANDBOX_CLIENT_ID : PAYPAL_LIVE_CLIENT_ID,
      clientSecret:
        env === "sandbox"
          ? PAYPAL_SANDBOX_CLIENT_SECRET
          : PAYPAL_LIVE_CLIENT_SECRET,
      intent: (PAYPAL_INTENT?.toUpperCase() as INTENT) || ("CAPTURE" as INTENT),
      currency: PAYPAL_CURRENCY || "USD",
      apiBaseUrl:
        PAYPAL_API_BASE_URL || env === "sandbox"
          ? "https://api-m.sandbox.paypal.com"
          : "https://api-m.paypal.com",
      webBaseUrl: PAYPAL_WEB_BASE_URL || "https://www.paypal.com",
      enableShippingAddressCallback:
        PAYPAL_ENABLE_SHIPPING_ADDRESS_CALLBACK === "true",
      enableShippingOptionsCallback:
        PAYPAL_ENABLE_SHIPPING_OPTIONS_CALLBACK === "true",
      demo: {
        shippingEmail: PAYPAL_DEMO_SHIPPING_EMAIL,
        shippingPhone: PAYPAL_DEMO_SHIPPING_PHONE,
        shippingCountryCode: PAYPAL_DEMO_SHIPPING_COUNTRY_CODE,
      },
    },
    deploymentEnvironmentBaseUrl: String(DEPLOYMENT_ENV_BASE_URL),
  };
}

export default getConfig();
