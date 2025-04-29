PayPal Checkout Integration Server Api Implementation (paypal-checkout-example-server)
=====

> [!NOTE]  
> This project has been forked from [paypal-examples/paypal-sdk-server-side-integration](https://github.com/paypal-examples/paypal-sdk-server-side-integration).

Node.js web server for testing a PayPal JS SDK and REST API integration. Built with the [Fastify web framework](https://www.fastify.io/).

## Quick Start

Copy `example.env` to a new file named `.env` in this project's root directory and add your API credentials to it. This will securely pass them and other config options to the Node.js web server as environment variables at runtime. The `.env` file with your credentials should _never_ be checked into git version control.

This application requires Node.js version 20 or higher. Please ensure you have installed and enabled the correct version.

Then install dependencies and start the local web server:

```bash
npm install
npm run dev
```

```mermaid
---
config:
  theme: neutral,
  style: {
    .actor: {
        fill: yellow;
    }
  }
---
sequenceDiagram
  autonumber
  actor Buyer as Buyer
  participant MerchantPage as Merchant Page
  participant PayPalJSSDK as PayPal JS SDK
  participant PayPalCheckout as PayPal Checkout

  participant MerchantServer as Merchant Server
  
  participant PayPalOrdersAPI as PayPal Orders API
  Note over Buyer, PayPalOrdersAPI: Checkout Process Start

  Buyer ->> MerchantPage: Visits checkout page
  MerchantPage -->> Buyer: Loads checkout page
  MerchantPage ->> PayPalJSSDK: init PayPal Button SDK via <script> tag / React SDK
  MerchantPage ->> MerchantPage: Renders PayPal buttons
  Buyer ->> MerchantPage: Clicks PayPal button(Start Checkout)
  PayPalJSSDK ->> MerchantPage: Triggers createOrder callback
  MerchantPage ->> MerchantServer: Requests to create order
  MerchantServer ->> PayPalOrdersAPI: POST /v2/checkout/orders
  PayPalOrdersAPI -->> MerchantServer: Returns Order ID
  MerchantServer -->> MerchantPage: Returns Order ID
  MerchantPage -->> PayPalJSSDK: Returns Order ID


  PayPalJSSDK ->> PayPalCheckout: Launches checkout browser Pop-up with Order ID
  Buyer ->> PayPalCheckout: Logs in with PayPal credentials
  Buyer ->> PayPalCheckout: Buyer Selects their shipping address
  PayPalCheckout ->> MerchantServer : Shipping Address Callback
  MerchantServer -->> PayPalCheckout : List of Supported Shipping Options
  Buyer ->> PayPalCheckout: Selects a Shipping Option
  PayPalCheckout ->> MerchantServer : Shipping Options Callback
  MerchantServer -->> PayPalCheckout : Updated Cart Information with updated Tax and other info as applicable
  Buyer ->> PayPalCheckout: Reviews order details
  Buyer ->> PayPalCheckout: Approves the Transaction
  PayPalCheckout ->> PayPalJSSDK: Returns to merchant site<br/>with approval data
  PayPalJSSDK ->> MerchantPage: onApprove callback<br/>sends request to capture payment
  MerchantPage ->> MerchantServer: Sends request to capture payment
  MerchantServer ->> PayPalOrdersAPI: Captures payment via<br/>ordersCapture method
  PayPalOrdersAPI -->> MerchantServer: Returns capture confirmation
  MerchantServer -->> MerchantPage: Returns payment confirmation
  MerchantPage -->> Buyer: Displays confirmation message
  Note over Buyer, PayPalOrdersAPI: Checkout Process Complete, Merchant can Ship the Product to the buyer
```