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

// exports.createCheckoutSession = asyncHandler(async (req, res, next) => {
//   const { packageId } = req.params;

//   const user = await User.findById(req.user._id);

//   if (!user) {
//     return next(new ApiError(`No user found`, 400));
//   }

//   const selectedPackage = await Package.findById(packageId);

//   if (!selectedPackage) {
//     return next(new ApiError(`No package found`, 400));
//   }
//   const stripeProduct = await stripe.products.retrieve(
//     selectedPackage.packageStripeId
//   );

//   const prices = await stripe.prices.list({
//     product: "prod_QGZw9iFJEhfZh0",
//   });
// // const yoo =prices.data.filter((price) => price.lookup_key== "starter_aed")[0];
//   console.log("====================================");
//   console.log("prices:", prices.data[0]);
//   console.log("====================================");

//   const price = await stripe.prices.retrieve(stripeProduct.default_price);
//   console.log("====================================");
//   console.log("stripeProduct:", stripeProduct);
//   console.log("====================================");
//   console.log("====================================");
//   console.log("price:", price);
//   console.log("selectedPackage:", selectedPackage);
//   console.log("====================================");

//   const session = await stripe.checkout.sessions.create({
//     line_items: [
//       {
//         price: stripeProduct.default_price,
//         quantity: 1,
//       },
//     ],
//     mode: "payment",
//     success_url: `${req.protocol}://${req.get("host")}/purchases`,
//     cancel_url: `${req.protocol}://${req.get("host")}/packages`,
//     customer_email: user.email,
//     client_reference_id: selectedPackage._id.toString(),
//     metadata: {
//       userId: user._id.toString(),
//       packageId: selectedPackage._id.toString(),
//       stripePackageId: selectedPackage.packageStripeId,
//     },
//   });

//   res.status(200).json({ success: true, session });
// });

// exports.createCheckoutSession = asyncHandler(async (req, res, next) => {
//   const { packageId } = req.params;
//   const { currency } = req.query;

//   const user = await User.findById(req.user._id);

//   if (!user) {
//     return next(new ApiError(`No user found`, 400));
//   }

//   const subscribedUser = await stripe.customers.list({
//     email:user.email,
//     limit: 1
//   })

//   console.log("====================================");
//   console.log("subscribedUser:", subscribedUser);
//   console.log("====================================");

//   const existSubscribtion = await stripe.subscriptions.list({
//     customer:subscribedUser.data[0].id,
//     // status: 'active',
//     // limit: 1
//   })

//   console.log("====================================");
//   console.log("existSubscribtion:", existSubscribtion);
//   console.log("====================================");

//   const selectedPackage = await Package.findById(packsageId);

//   if (!selectedPackage) {
//     return next(new ApiError(`No package found`, 400));
//   }

//   // Find the price in the selected package that matches the requested currency
//   const selectedPrice = selectedPackage.prices.find(price => price.currency === currency.toLowerCase());

//   if (!selectedPrice) {
//     return next(new ApiError(`No price found for the specified currency`, 400));
//   }

//   console.log("====================================");
//   console.log("selectedPrice:", selectedPrice);
//   console.log("====================================");

//   const session = await stripe.checkout.sessions.create({
//     line_items: [
//       {
//         price: selectedPrice.stripePriceId,
//         quantity: 1,
//       },
//     ],
//     mode: "subscription", // Assuming a subscription model
//     success_url: `${req.protocol}://${req.get("host")}/purchases`,
//     cancel_url: `${req.protocol}://${req.get("host")}/packages`,
//     customer_email: user.email,
//     client_reference_id: selectedPackage._id.toString(),
//     metadata: {
//       userId: user._id.toString(),
//       packageId: selectedPackage._id.toString(),
//       stripePackageId: selectedPackage.packageStripeId,
//     },
//   });

//   res.status(200).json({ success: true, session });
// });

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

  console.log("====================================");
  console.log("stripeProduct", stripeProduct);
  console.log("====================================");

  console.log("////////////////////////////////////");
  const selectedPrice = selectedPackage.prices.find(
    (price) => price.currency === currency.toLowerCase()
  );

  console.log("====================================");
  console.log("selectedPackage", selectedPrice.stripePriceId);
  console.log("====================================");
  const priceId = selectedPrice.stripePriceId;

  // Check if the user already exists in Stripe
  let stripeCustomer;
  const customers = await stripe.customers.list({ email: user.email });
  if (customers.data.length > 0) {
    stripeCustomer = customers.data[0];
  }

  console.log("====================================");
  console.log("stripeCustomer", stripeCustomer);
  console.log("====================================");

  // If the user exists, check for active subscriptions
  if (stripeCustomer) {
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomer.id,
      status: "active",
      expand: ["data.default_payment_method"],
    });

    console.log("====================================");
    console.log("subscriptions", subscriptions.data);
    console.log("====================================");

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
  console.log("====================================");
  console.log("priceId", priceId);
  console.log("====================================");
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
