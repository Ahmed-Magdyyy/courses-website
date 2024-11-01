const asyncHandler = require("express-async-handler");
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const ApiError = require("../utils/ApiError");
const User = require("../models/userModel");
const Package = require("../models/packagesModel");
const bankTransferModel = require("../models/bankTransferModel");

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
      // Create a subscription price in Stripe
      const stripeSubscriptionPrice = await stripe.prices.create({
        unit_amount: price.amount * 100,
        currency: price.currency,
        recurring: { interval: "month" },
        product: product.id,
      });

      // Create a one-time payment price in Stripe
      const stripeOneTimePrice = await stripe.prices.create({
        unit_amount: price.amount * 100,
        currency: price.currency,
        product: product.id,
      });

      packageData.prices.push({
        currency: price.currency,
        amount: price.amount,
        stripePriceId: {
          subscription: stripeSubscriptionPrice.id,
          oneTime: stripeOneTimePrice.id,
        },
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
  if (req.user.role === "superAdmin" || req.user.role === "admin") {
    const packages = await Package.find({})
      .sort({ createdAt: -1 })
      .populate("visibleTo", "_id name email");
    res.status(200).json({ message: "Success", data: packages });
  } else {
    const packages = await Package.find({
      active: true,
      $or: [
        { visibleTo: { $size: 0 } },
        { visibleTo: { $in: [req.user._id] } },
      ],
    })
      .sort({ createdAt: -1 })
      .populate("visibleTo", "_id name email");

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

  if (!selectedPrice || !selectedPrice.stripePriceId.subscription) {
    return next(
      new ApiError(`No price found for the currency you entered`, 400)
    );
  }

  const priceId = selectedPrice.stripePriceId.subscription;

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
      system: "jawwid",
      userId: user._id.toString(),
      packageId: selectedPackage._id.toString(),
      stripePackageId: selectedPackage.packageStripeId,
      classesNum: selectedPackage.classesNum,
    },
  });

  res
    .status(200)
    .json({ message: "session created successfully", url: session.url });
});

exports.createOneTimePaymentSession = asyncHandler(async (req, res, next) => {
  const { packageId } = req.params;
  const { currency } = req.query;

  // Find the user based on the request
  const user = await User.findById(req.user._id);
  if (!user) {
    return next(new ApiError(`No user found`, 400));
  }

  // Find the package based on the package ID
  const selectedPackage = await Package.findById(packageId);
  if (!selectedPackage) {
    return next(new ApiError(`No package found`, 400));
  }
  // Find the price based on the provided currency
  const selectedPrice = selectedPackage.prices.find(
    (price) => price.currency.toLowerCase() === currency.toLowerCase()
  );

  if (!selectedPrice || !selectedPrice.stripePriceId.oneTime) {
    return next(
      new ApiError(`No price found for the currency you entered`, 400)
    );
  }

  const priceId = selectedPrice.stripePriceId.oneTime;

  // Check if the user already exists in Stripe, if not create a new Stripe customer
  let stripeCustomer;
  const customers = await stripe.customers.list({ email: user.email });
  if (customers.data.length > 0) {
    stripeCustomer = customers.data[0];
  } else {
    stripeCustomer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      phone: user.phone,
    });

    // Update the user in your database with the stripeCustomerId
    user.subscription.stripeCustomerId = stripeCustomer.id;
    await user.save();
  }

  const metadata = {
    system: "jawwid",
    userId: user._id.toString(),
    packageId: selectedPackage._id.toString(),
    stripePackageId: selectedPackage.packageStripeId,
    classesNum: selectedPackage.classesNum,
  };

  // Create a new one-time payment session
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
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
    metadata,
    payment_intent_data: {
      metadata,
    },
  });

  res.status(200).json({
    message: "One-time payment session created successfully",
    url: session.url,
  });
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

  try {
    switch (event.type) {
      case "checkout.session.completed":
        if (event.data.object.mode === "subscription") {
          const subscription = await stripe.subscriptions.retrieve(
            event.data.object.subscription
          );

          await handleSubscriptionCreated(event.data.object, subscription);
        } else if (event.data.object.mode === "payment") {
          const paymentIntentId = event.data.object.payment_intent;
          const paymentIntent = await stripe.paymentIntents.retrieve(
            paymentIntentId
          );

          await handleOneTimePaymentCreated(event.data.object, paymentIntent);
        }
        break;

      case "customer.subscription.updated":
        console.log("Subscription status updated");
        await handleSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        console.log("Subscription canceled immediately");
        await handleSubscriptionDeleted(event.data.object);
        break;

      // case "invoice.payment_succeeded":
      //   // Retrieve the invoice object
      //   const invoice = await stripe.invoices.retrieve(event.data.object.id);
      //   const checkoutSessionId = invoice.metadata.checkout_session_id;

      //   await handleInvoicePaymentSucceeded(
      //     event.data.object.id,
      //     checkoutSessionId
      //   );
      //   break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  } catch (error) {
    console.error(`Error processing ${event.type}: ${error.message}`);
  }

  res.json({ received: true });
});

const handleSubscriptionCreated = async (session, subscription) => {
  const userId = session.metadata.userId;
  const user = await User.findById(userId);
  const subscription_start = new Date(subscription.current_period_start * 1000);
  const subscription_end = new Date(subscription.current_period_end * 1000);

  if (user) {
    if (user.role === "student" || user.role === "guest") {
      if (user.role === "guest") user.role = "student";
      user.remainingClasses =
        parseInt(user.remainingClasses, 10) +
        parseInt(session.metadata.classesNum, 10);
      user.subscription = {
        type: "monthly",
        paymentType: "visa",
        package: session.metadata.packageId,
        packageStripeId: session.metadata.stripePackageId,
        status: "active",
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: session.customer,
        subscription_start: subscription_start.toISOString().split("T")[0],
        subscription_end: subscription_end.toISOString().split("T")[0],
      };
    }
    await user.save();

    const invoices = await stripe.invoices.list({
      subscription: subscription.id,
    });

    if (invoices.data.length > 0) {
      const firstInvoice = invoices.data[0];
      await stripe.invoices.update(firstInvoice.id, {
        metadata: session.metadata,
      });
    }

    console.log(
      `Subscription started for user: ${user.email} and an invoice was issued`
    );
  } else {
    console.log(`User not found for ID: ${userId}`);
  }
};

const handleSubscriptionDeleted = async (subscription) => {
  const user = await User.findOne({
    "subscription.stripeSubscriptionId": subscription.id,
  });

  if (user) {
    user.subscription.type = null;
    user.subscription.paymentType = null;
    user.subscription.package = null;
    user.subscription.packageStripeId = null;
    user.subscription.status = "cancelled";
    user.subscription.stripeSubscriptionId = null;
    user.subscription.subscription_start = "";
    user.subscription.subscription_end = "";

    await user.save();
    console.log(`Subscription canceled immediately for user: ${user.email}`);
  } else {
    console.log(`User not found for subscription ID: ${subscription.id}`);
  }
};

const handleSubscriptionUpdated = async (subscription) => {
  const user = await User.findOne({
    "subscription.stripeSubscriptionId": subscription.id,
  });
  if (user) {
    if (subscription.cancel_at_period_end === true) {
      user.subscription.status = "cancelled";
    } else if (subscription.cancel_at_period_end === false) {
      user.subscription.status = "active";
    }

    // Handle other statuses if needed
    await user.save();
  }
};

const handleOneTimePaymentCreated = async (session, payment) => {
  const userId = session.metadata.userId;
  const user = await User.findById(userId);

  if (user) {
    if (user.role === "student" || user.role === "guest") {
      user.role = "student";
      user.remainingClasses =
        parseInt(user.remainingClasses, 10) +
        parseInt(session.metadata.classesNum, 10);
      user.subscription = {
        type: "oneTime",
        paymentType: "visa",
        package: session.metadata.packageId,
        packageStripeId: session.metadata.stripePackageId,
        status: null,
        stripeSubscriptionId: null,
        stripeCustomerId: session.customer,
        subscription_start: "",
        subscription_end: "",
      };
    }
    await user.save();
    console.log(`user: ${user.email} made a successful payment`);
  } else {
    console.log(`User not found for ID: ${userId}`);
  }
};

// const handleInvoicePaymentSucceeded = async (invoiceId, checkoutSessionId) => {
//   try {
//     // Delay processing to allow time for session completion
//     await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 seconds delay

//     if (!checkoutSessionId) {
//       console.error(`No checkout session ID passed`);
//       return;
//     }

//     // Retrieve the associated checkout session
//     const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);

//     // Update the invoice with metadata from the checkout session
//     await stripe.invoices.update(invoiceId, {
//       metadata: {
//         system: session.metadata.system,
//         userId: session.metadata.userId,
//         packageId: session.metadata.packageId,
//         stripePackageId: session.metadata.stripePackageId,
//         classesNum: session.metadata.classesNum,
//       },
//     });

//     console.log(`Invoice updated with metadata for invoice ID: ${invoiceId}`);
//   } catch (error) {
//     console.error(`Failed to update invoice with metadata: ${error.message}`);
//   }
// };

exports.updatePackage = asyncHandler(async (req, res, next) => {
  const { packageId } = req.params;
  const { title, prices, classesNum, visibleTo } = req.body;

  // Find the package in the database
  const existingPackage = await Package.findById(packageId);

  if (!existingPackage) {
    return next(new ApiError("Package not found", 404));
  }

  try {
    // Update product in Stripe
    await stripe.products.update(existingPackage.packageStripeId, {
      name: title,
    });

    // Deactivate old prices in Stripe (both subscription and one-time prices)
    for (const oldPrice of existingPackage.prices) {
      await stripe.prices.update(oldPrice.stripePriceId.subscription, {
        active: false,
      });
      await stripe.prices.update(oldPrice.stripePriceId.oneTime, {
        active: false,
      });
    }

    // Create new prices in Stripe
    const newPrices = [];
    for (const price of prices) {
      // Create subscription price in Stripe
      const stripeSubscriptionPrice = await stripe.prices.create({
        unit_amount: price.amount * 100,
        currency: price.currency,
        recurring: { interval: "month" },
        product: existingPackage.packageStripeId,
      });

      // Create one-time price in Stripe
      const stripeOneTimePrice = await stripe.prices.create({
        unit_amount: price.amount * 100,
        currency: price.currency,
        product: existingPackage.packageStripeId,
      });

      newPrices.push({
        currency: price.currency,
        amount: price.amount,
        stripePriceId: {
          subscription: stripeSubscriptionPrice.id,
          oneTime: stripeOneTimePrice.id,
        },
      });
    }

    // Update the package in the database
    existingPackage.title = title;
    existingPackage.prices = newPrices;
    existingPackage.classesNum = classesNum;
    existingPackage.visibleTo = visibleTo || [];

    await existingPackage.save();

    res.status(200).json({
      message: "Package updated successfully",
      data: existingPackage,
    });
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
    .select("name email phone subscription");

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
        subscriptionStatus: user.subscription.status,
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

    res.status(200).json({
      message: "Success",
      data: paidInvoices,
    });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ message: "Error fetching invoices", error });
  }
});

exports.getAllOneTimePayments = asyncHandler(async (req, res, next) => {
  try {
    // Fetch all paid charges
    const charges = await stripe.charges.list({
      limit: 100, // Adjust the limit as necessary
      paid: true, // Only include charges that have been successfully paid
      expand: ["data.invoice"],
    });

    // Filter to include only one-time payments related to your new system
    const oneTimePayments = charges.data.filter((charge) => {
      return charge.metadata.system === "jawwid" && !charge.invoice;
    });

    const formattedCharges = oneTimePayments.map((charge) => ({
      chargeId: charge.id,
      customer_name: charge.billing_details.name || "N/A",
      customer_email: charge.billing_details.email || "N/A",
      description: charge.description || "One-time payment",
      amount_paid: charge.amount / 100, // Convert from cents to currency
      currency: charge.currency.toUpperCase(),
      created_at: new Date(charge.created * 1000),
      receipt_url: charge.receipt_url,
    }));

    res.status(200).json({
      message: "Success",
      data: formattedCharges,
    });
  } catch (error) {
    console.error("Error fetching charges:", error);
    res.status(500).json({ message: "Error fetching payments", error });
  }
});

exports.getStudentInvoicesAndPayments = asyncHandler(async (req, res, next) => {
  try {
    const stripeCustomerId = req.user.subscription.stripeCustomerId;

    if (stripeCustomerId !== null) {
      // Fetch all invoices for the customer
      const invoices = await stripe.invoices.list({
        customer: stripeCustomerId,
      });

      // Filter invoices with metadata.system set to "jawwid"
      const filteredInvoices = invoices.data.filter(
        (invoice) => invoice.metadata.system === "jawwid"
      );

      // Map filtered invoices to desired format
      const studentInvoices = filteredInvoices.map((invoice) => ({
        invoiceId: invoice.id,
        status: invoice.status,
        invoice_number: invoice.number,
        customer_name: invoice.customer_name || "N/A",
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

      // Fetch all paid charges (one-time payments) for the customer
      const charges = await stripe.charges.list({
        customer: stripeCustomerId,
        limit: 100,
        paid: true,
      });

      // Filter charges that are one-time payments (not associated with an invoice)
      const oneTimePayments = charges.data.filter(
        (charge) => charge.metadata.system === "jawwid" && !charge.invoice
      );

      // Map filtered charges to desired format
      const formattedCharges = oneTimePayments.map((charge) => ({
        chargeId: charge.id,
        customer_name: charge.billing_details.name || "N/A",
        customer_email: charge.billing_details.email || "N/A",
        description: charge.description || "One-time payment",
        amount_paid: charge.amount / 100,
        currency: charge.currency.toUpperCase(),
        created_at: new Date(charge.created * 1000),
        receipt_url: charge.receipt_url,
      }));

      // Combine both invoices and one-time payments into a single response
      res.status(200).json({
        message: "Success",
        invoices: studentInvoices,
        oneTimePayments: formattedCharges,
      });
    } else {
      res.status(200).json({ message: "No invoices or payments found" });
    }
  } catch (error) {
    console.error("Error fetching invoices and payments:", error);
    res
      .status(500)
      .json({ message: "Error fetching invoices and payments", error });
  }
});

exports.confirmBankTransferPayment = asyncHandler(async (req, res, next) => {
  const {
    referenceNum,
    student,
    amountReceived,
    currency,
    packageId,
    subscription_start,
    subscription_end,
  } = req.body;

  const user = await User.findById(student);

  if (!user) {
    return next(new ApiError(`No user found`, 400));
  }

  const selectedPackage = await Package.findById(packageId);

  if (!selectedPackage) {
    return next(new ApiError(`No package found`, 400));
  }

  user.subscription.status = "active";
  user.subscription.paymentType = "bank transfer";
  user.subscription.package = selectedPackage._id;
  user.subscription.subscription_start = subscription_start;
  user.subscription.subscription_end = subscription_end;
  user.remainingClasses =
    parseInt(user.remainingClasses, 10) +
    parseInt(selectedPackage.classesNum, 10);

  await user.save();

  const bankTransferConfirmation = await bankTransferModel.create({
    referenceNum,
    student,
    studentName: user.name,
    studentEmail: user.email,
    amountReceived,
    currency,
    packageId: selectedPackage._id,
    psckageName: selectedPackage.title,
    subscription_start,
    subscription_end,
  });

  res.status(200).json({ message: "Success", bankTransferConfirmation });
});

exports.getBankTransfer = asyncHandler(async (req, res, next) => {
  let filter = {};
  const { page, limit, ...query } = req.query;

  const pageNum = page * 1 || 1;
  const limitNum = limit * 1 || 5;
  const skipNum = (pageNum - 1) * limit;

  // Modify the filter to support partial matches for string fields
  Object.keys(query).forEach((key) => {
    if (typeof query[key] === "string") {
      filter[key] = { $regex: query[key], $options: "i" }; // Case-insensitive partial match
    } else {
      filter[key] = query[key];
    }
  });

  const count = await bankTransferModel.countDocuments(filter);
  const totalPages = Math.ceil(count / limitNum);

  const documents = await bankTransferModel
    .find(filter)
    .sort({ createdAt: -1 })
    .skip(skipNum)
    .limit(limitNum);

  res.status(200).json({
    totalPages,
    page: pageNum,
    results: documents.length,
    data: documents,
  });
});
