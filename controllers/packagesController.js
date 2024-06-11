const asyncHandler = require("express-async-handler");
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const ApiError = require("../utils/ApiError");
const User = require("../models/userModel");
const Package = require("../models/packagesModel");

exports.createPackage = asyncHandler(async (req, res, next) => {
  const { title, prices, classesNum, visibleTo } = req.body;

  try {
    const product = await stripe.products.create({
      name: title,
    });

    const packageData = {
      title,
      prices: [],
      classesNum,
      visibleTo: visibleTo || [], // Default to empty array if not specified
      packageStripeId: product.id,
    };

    for (const price of prices) {
      const stripePrice = await stripe.prices.create({
        unit_amount: price.amount * 100,
        currency: price.currency,
        recurring: { interval: "month" },
        product: product.id,
      });

      packageData.prices.push({
        currency: price.currency,
        amount: price.amount,
        stripePriceId: stripePrice.id,
      });
    }

    const package = await Package.create(packageData);

    res.status(201).json({ message: "Success", data: package });
  } catch (error) {
    console.error("Error creating package:", error);
    next(error);
    res.status(500).json({ message: "Error creating package", error });
  }
});

exports.getPackages = asyncHandler(async (req, res, next) => {
  const packages = await Package.find({});

  res.status(200).json({ message: "Success", data: packages });
});

exports.createCheckoutSession = asyncHandler(async (req, res, next) => {
  const { packageId } = req.params;
  const { currency } = req.query;

  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new ApiError(`No user found`, 400));
  }

  const selectedPackage = await Package.findById(packageId);

  if (!selectedPackage) {
    return next(new ApiError(`No package found`, 400));
  }

  const stripeProduct = await stripe.products.retrieve(
    selectedPackage.packageStripeId
  );

  const selectedPrice = selectedPackage.prices.find(
    (price) => price.currency === currency.toLowerCase()
  );

  const priceId = selectedPrice.stripePriceId;

  // Check if the user already exists in Stripe
  let stripeCustomer;
  const customers = await stripe.customers.list({ email: user.email });
  if (customers.data.length > 0) {
    stripeCustomer = customers.data[0];
  }

  // If the user exists, check for active subscriptions
  if (stripeCustomer) {
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomer.id,
      status: "active",
      expand: ["data.default_payment_method"],
    });

    if (subscriptions.data.length > 0) {
      // Redirect to the customer portal to manage the subscription
      const session = await stripe.billingPortal.sessions.create({
        customer: stripeCustomer.id,
        return_url: `${req.protocol}://${req.get("host")}/subscriptions`,
      });

      return res.status(200).json({ url: session.url });
    }
  } else {
    // If the user does not exist in Stripe, create a new customer
    stripeCustomer = await stripe.customers.create({
      email: user.email,
      name: user.name,
    });

    // Update the user in your database with the stripeCustomerId
    user.subscription.stripeCustomerId = stripeCustomer.id;
    await user.save();
  }

  // Create a new checkout session
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${req.protocol}://${req.get("host")}/subscriptions`,
    cancel_url: `${req.protocol}://${req.get("host")}/packages`,
    customer: stripeCustomer.id,
    client_reference_id: selectedPackage._id.toString(),
    metadata: {
      userId: user._id.toString(),
      packageId: selectedPackage._id.toString(),
      stripePackageId: selectedPackage.packageStripeId,
    },
  });

  res.status(200).json({ success: true, session });
});

exports.webhook = asyncHandler(async (req, res, next) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object;
      if (session.mode === 'subscription') {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        await handleSubscriptionCreated(session, subscription);
      }
      break;
    case "invoice.payment_succeeded":
      const invoice = event.data.object;
      await handleInvoicePaymentSucceeded(invoice);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });

})

async function handleSubscriptionCreated(session, subscription) {
  const userId = session.metadata.userId;
  const user = await User.findById(userId);
  if (user) {
    user.subscribed = true;
    user.subscription = {
      package: session.metadata.packageId,
      packageStripeId: session.metadata.stripePackageId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: session.customer,
    };
    await user.save();
    console.log(`Subscription started for user: ${user.email}`);
  } else {
    console.log(`User not found for ID: ${userId}`);
  }
}

async function handleInvoicePaymentSucceeded(invoice) {
  const userId = invoice.metadata.userId;
  const user = await User.findById(userId);
  if (user) {
    console.log(`Sending invoice to ${user.email} with details:`, invoice);
  } else {
    console.log(`User not found for ID: ${userId}`);
  }
}
