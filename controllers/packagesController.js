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

exports.getSpeceficPackage = asyncHandler(async (req, res, next) => {
  const { packageId } = req.params;

  const package = await Package.findById(packageId).populate(
    "visibleTo",
    "_id name email"
  );

  if (!package) {
    return next(new ApiError(`No package found`, 400));
  }

  res.status(200).json({ message: "Success", package });
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
    (price) => price.currency.toLowerCase() === currency.toLowerCase()
  );

  if (!selectedPrice) {
    return next(
      new ApiError(`No price found for the currency you entered`, 400)
    );
  }

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
        return_url: `https://learning.jawwid.com/subscriptions/packages`,
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
      phone: user.phone,
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
    success_url: `https://learning.jawwid.com/subscriptions/packages`,
    cancel_url: `https://learning.jawwid.com/subscriptions/packages`,
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
      if (event.data.object.mode === "subscription") {
        const subscription = await stripe.subscriptions.retrieve(
          event.data.object.subscription
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

const handleSubscriptionCreated = async (session, subscription) => {
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
};

const handleSubscriptionUpdated = async (subscription) => {
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

exports.getPackageSubscriptions = asyncHandler(async (req, res, next) => {
  const { packageId } = req.query;
  let filter = {};

  if (packageId) {
    filter = { "subscription.package": packageId };
  } else {
    filter = { "subscription.package": { $ne: null } };
  }

  // Retrieve subscriptions from the database
  const users = await User.find(filter)
    .populate("subscription.package", "title")
    .select("name email phone subscription subscriptionStatus");

  if (!users.length) {
    return next(new ApiError("No users subscribed to this package", 404));
  }

  // Map through users and retrieve subscription data from Stripe
  const subscriptions = await Promise.all(
    users.map(async (user) => {
      let stripeSubscriptionDetails = null;

      if (user.subscription.stripeSubscriptionId) {
        try {
          const stripeSubscription = await stripe.subscriptions.retrieve(
            user.subscription.stripeSubscriptionId
          );

          const customer = await stripe.customers.retrieve(
            stripeSubscription.customer
          );
          const latestInvoice = await stripe.invoices.retrieve(
            stripeSubscription.latest_invoice
          );

          stripeSubscriptionDetails = {
            subscriptionId: stripeSubscription.id,
            customer_name: customer.name,
            customer_email: customer.email,
            customer_phone: customer.phone,
            amount_paid: latestInvoice.amount_paid / 100,
            currency: stripeSubscription.currency,
            subscription_start: new Date(
              stripeSubscription.current_period_start * 1000
            ),
            subscription_end: new Date(
              stripeSubscription.current_period_end * 1000
            ),
            package_name: user.subscription.package.title,
          };
        } catch (error) {
          console.error(
            `Error retrieving Stripe subscription for user ${user.email}:`,
            error
          );
        }
      }

      return {
        name: user.name,
        email: user.email,
        phone: user.phone,
        subscriptionStatus: user.subscriptionStatus,
        package: user.subscription.package,
        stripeSubscription: stripeSubscriptionDetails,
      };
    })
  );

  res.status(200).json({
    message: "Success",
    data: subscriptions,
  });
});

// allow student to manage their own subscription
exports.managePackageSubscription = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  // Find the user by ID
  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  console.log("tststs", userId);
  console.log(user.subscription.stripeSubscriptionId);

  // Check if the user has a Stripe customer ID
  if (user.subscription.stripeSubscriptionId === null) {
    return res.status(400).json({ message: "No subscription found for user" });
  }

  // Create a session for the Stripe Customer Portal
  const session = await stripe.billingPortal.sessions.create({
    customer: user.subscription.stripeCustomerId,
    return_url: `https://learning.jawwid.com/subscriptions/packages`,
  });

  // Respond with the URL of the Stripe Customer Portal session
  res.status(200).json({ url: session.url });
});

exports.getAllPaidInvoices = asyncHandler(async (req, res, next) => {
  try {
    // Destructure page and limit from request params with default values
    const { page = 1, limit = 10 } = req.query;

    // Validate page and limit parameters (optional, for extra security)
    if (page < 1 || limit < 1 || limit > 100) {
      return res
        .status(400)
        .json({ message: "Invalid page or limit parameters" });
    }

    const startingAfter = req.query.starting_after; // Optional cursor for pagination
    const endingBefore = req.query.ending_before; // Optional cursor for pagination (mutually exclusive with startingAfter)

    const stripeParams = {
      status: "paid",
      limit: Math.min(limit, 100), // Enforce maximum limit of 100 for security
    };

    // Use startingAfter or endingBefore for pagination if provided
    if (startingAfter) {
      stripeParams.starting_after = startingAfter;
    } else if (endingBefore) {
      stripeParams.ending_before = endingBefore;
    }

    const invoices = await stripe.invoices.list(stripeParams);

    // Transform invoices to desired format
    const paidInvoices = invoices.data.map((invoice) => ({
      invoiceId: invoice.id,
      invoice_number: invoice.number,
      customer_name: invoice.customer_name || "N/A", // Fallback if customer_name is not available
      customer_email: invoice.customer_email,
      package_name: invoice.lines.data[0].description.split("× ")[1],
      amount_paid: invoice.amount_paid / 100,
      currency: invoice.currency.toUpperCase(),
      subscription_start: new Date(invoice.lines.data[0].period.start * 1000),
      subscription_end: new Date(invoice.lines.data[0].period.end * 1000),
      invoice_url: invoice.hosted_invoice_url,
      invoice_pdf: invoice.invoice_pdf,
      created_at: new Date(invoice.created * 1000),
    }));

    const hasNextPage = invoices.has_more; // Check for next page based on Stripe response
    const nextStartingAfter = invoices.data[invoices.data.length - 1].id; // Get next page cursor (starting_after)

    res.status(200).json({
      message: "Success",
      data: paidInvoices,
      pagination: {
        hasNextPage,
        nextStartingAfter, // Include next page cursor for client-side pagination
      },
    });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ message: "Error fetching invoices", error });
  }
});
