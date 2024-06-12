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
  if (req.user.role === "superAdmin") {
    const packages = await Package.find({}).populate(
      "visibleTo",
      "_id name email"
    );
    res.status(200).json({ message: "Success", data: packages });
  } else {
    const packages = await Package.find({
      active: true,
      $or: [
        { visibleTo: { $size: 0 } },
        { visibleTo: { $in: [req.user._id] } },
      ],
    }).populate("visibleTo", "_id name email");

    res.status(200).json({ message: "Success", data: packages });
  }
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

      return res.status(200).json({
        message: "User already have an active subscription",
        url: session.url,
      });
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
      classesNum: selectedPackage.classesNum,
    },
  });

  res
    .status(200)
    .json({ message: "session created successfully", url: session.url });
  // res.status(200).redirect(session.url);
});

exports.webhook = asyncHandler(async (req, res, next) => {
  console.log("====================================");
  console.log("webhook hitted");
  console.log("====================================");
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed":
      if (session.mode === "subscription") {
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription
        );
        await handleSubscriptionCreated(event.data.object, subscription);
      }
      break;

    case "customer.subscription.updated":
      console.log("customer cancelled subscription");
      await handleSubscriptionUpdated(event.data.object);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

async function handleSubscriptionCreated(session, subscription) {
  const userId = session.metadata.userId;
  const user = await User.findById(userId);

  if (user) {
    if (user.role === "student")
      user.remainingClasses =
        parseInt(user.remainingClasses, 10) +
        parseInt(session.metadata.classesNum, 10);
    user.subscriptionStatus = "active";
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

const handleSubscriptionUpdated = async (subscription) => {
  console.log("handleSubscriptionUpdated triggerd");
  console.log("subscription:", subscription);
  console.log("cancel_at_period_end:", subscription.cancel_at_period_end);
  const user = await User.findOne({
    "subscription.stripeSubscriptionId": subscription.id,
  });
  if (user) {
    if (subscription.cancel_at_period_end === true) {
      user.subscriptionStatus = "cancelled";
    } else if (subscription.cancel_at_period_end === false) {
      user.subscriptionStatus = "active";
    }

    // Handle other statuses if needed
    await user.save();
  }
};

// async function handleInvoicePaymentSucceeded(invoice) {
//   const userId = invoice.metadata.userId;
//   const user = await User.findOne({ email: invoice.customer_email });
//   if (user) {
//     user.subscription.stripeInvoiceId = invoice.id;
//     await user.save();
//     console.log(`Sending invoice to ${user.email} with details:`, invoice);
//   } else {
//     console.log(`User not found for ID: ${userId}`);
//   }
// }

exports.updatePackage = asyncHandler(async (req, res, next) => {
  const { packageId } = req.params;
  const { title, prices, discountedPrice, classesNum, visibleTo } = req.body;

  // Find the package in the database
  const existingPackage = await Package.findById(packageId);

  if (!existingPackage) {
    return next(new ApiError("Package not found", 404));
  }

  try {
    // Update product in Stripe
    const updatedProduct = await stripe.products.update(
      existingPackage.packageStripeId,
      {
        name: title,
      }
    );

    // Deactivate old prices in Stripe
    for (const oldPrice of existingPackage.prices) {
      await stripe.prices.update(oldPrice.stripePriceId, { active: false });
    }

    // Create new prices in Stripe
    const newPrices = [];
    for (const price of prices) {
      const stripePrice = await stripe.prices.create({
        unit_amount: price.amount * 100,
        currency: price.currency,
        recurring: { interval: "month" },
        product: existingPackage.packageStripeId,
      });

      newPrices.push({
        currency: price.currency,
        amount: price.amount,
        stripePriceId: stripePrice.id,
      });
    }

    // Update the package in the database
    existingPackage.title = title;
    existingPackage.prices = newPrices;
    existingPackage.discountedPrice = discountedPrice || null;
    existingPackage.classesNum = classesNum;
    existingPackage.visibleTo = visibleTo || [];

    await existingPackage.save();

    res
      .status(200)
      .json({ message: "Package updated successfully", data: existingPackage });
  } catch (error) {
    console.error("Error updating package:", error);
    next(new ApiError("Error updating package", 500));
  }
});

exports.deactivatePackage = asyncHandler(async (req, res, next) => {
  const { packageId } = req.params;

  // Find the package by ID
  const package = await Package.findById(packageId);

  if (!package) {
    return res.status(404).json({ message: "Package not found" });
  }

  // Set package as inactive in the database
  package.active = false;
  await package.save();

  // Archive the product on Stripe
  await stripe.products.update(package.packageStripeId, {
    active: false,
  });

  res.status(200).json({ message: "Package successfully deactivated" });
});

exports.reactivatePackage = asyncHandler(async (req, res, next) => {
  const { packageId } = req.params;

  // Find the package by ID
  const package = await Package.findById(packageId);

  if (!package) {
    return res.status(404).json({ message: "Package not found" });
  }

  // Set package as active in the database
  package.active = true;
  await package.save();

  // Reactivate the product on Stripe
  await stripe.products.update(package.packageStripeId, {
    active: true,
  });

  res.status(200).json({ message: "Package successfully reactivated" });
});
