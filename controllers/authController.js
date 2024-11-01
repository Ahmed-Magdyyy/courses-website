const crypto = require("crypto");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");

const usersModel = require("../models/userModel");

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const sendEmail = require("../utils/sendEmails");
const createToken = require("../utils/createToken");

exports.signup = asyncHandler(async (req, res, next) => {
  // Create a new user
  const user = await usersModel.create({
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    password: req.body.password,
    role: req.body.role,
    timezone: req.body.timezone
  });

  // Generate token and send it to the client side
  const token = createToken(user._id, user.role);

  // send confirmation email
  let capitalizeFirlstLetterOfName =
    user.name.split(" ")[0].charAt(0).toUpperCase() +
    user.name.split(" ")[0].slice(1).toLocaleLowerCase();

    let img ="https://user.jawwid.com/resize/resized/200x60/uploads/company/picture/33387/JawwidLogo.png"

  let emailTamplate = `<!DOCTYPE html>
  <html lang="en-US">
    <head>
      <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
      <title>Confirm Your Email</title>
      <meta name="description" content="Reset Password Email" />
      <style type="text/css">
        a:hover {
          text-decoration: underline !important;
        }
      </style>
    </head>

    <body
      marginheight="0"
      topmargin="0"
      marginwidth="0"
      style="margin: 0px; background-color: #f2f3f8"
      leftmargin="0"
    >
      <!--100% body table-->
      <table
        cellspacing="0"
        border="0"
        cellpadding="0"
        width="100%"
        bgcolor="#f2f3f8"
        style="
          @import url(https://fonts.googleapis.com/css?family=Rubik:300,400,500,700|Open+Sans:300,400,600,700);
          font-family: 'Open Sans', sans-serif;
        "
      >
        <tr>
          <td>
            <table
              style="background-color: #f2f3f8; max-width: 670px; margin: 0 auto"
              width="100%"
              border="0"
              align="center"
              cellpadding="0"
              cellspacing="0"
            >
              <tr>
                <td style="height: 80px">&nbsp;</td>
              </tr>
              <tr>
                <td style="text-align: center">
                  <a href="https://learning.jawwid.com" title="logo" target="_blank">
                    <img
                      width="250"
                      src=${img}
                      title="logo"
                      alt="logo"
                    />
                  </a>
                </td>
              </tr>
              <tr>
                <td style="height: 20px">&nbsp;</td>
              </tr>
              <tr>
                <td>
                  <table
                    width="95%"
                    border="0"
                    align="center"
                    cellpadding="0"
                    cellspacing="0"
                    style="
                      max-width: 670px;
                      background: #fff;
                      border-radius: 3px;
                      text-align: center;
                      -webkit-box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                      -moz-box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                      box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                    "
                  >
                    <tr>
                      <td style="height: 40px">&nbsp;</td>
                    </tr>
                    <tr>
                      <td style="padding: 0 35px">
                        <span
                          style="
                            display: inline-block;
                            vertical-align: middle;
                            margin: 29px 0 26px;
                            border-bottom: 1px solid #cecece;
                            width: 200px;
                          "
                        ></span>
                        <p
                          style="
                            color: #455056;
                            font-size: 17px;
                            line-height: 24px;
                            text-align: left;
                          "
                        >
                          Hello ${capitalizeFirlstLetterOfName},</p>
                        <p
                          style="
                            color: #455056;
                            font-size: 17px;
                            line-height: 24px;
                            text-align: left;
                          "
                        >
                          Thank you for registering in Jaweed website. To start using your account please confirm your email address by clicking on the confirm your email button.
                        </p>
                        <a target="_blank" href="https://courses-website-t4cr.onrender.com/api/v1/auth/confirm-email/${token}"
                        style="background:#20e277;text-decoration:none !important; font-weight:500; margin-top:25px; color:#fff;text-transform:uppercase; font-size:14px;padding:10px 24px;display:inline-block;border-radius:50px;">Confirm Your Email</a>

                        <p
                          style="
                            color: #455056;
                            font-size: 17px;
                            line-height: 24px;
                            text-align: left;
                          "
                        >
                          Welcome to Jaweed website,
                        </p>
                        <p
                          style="
                          margin-top: 3px;
                            color: #455056;
                            font-size: 17px;
                            line-height: 2px;
                            text-align: left;
                          "
                        >
                          The Jaweed Team.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="height: 40px">&nbsp;</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="height: 20px">&nbsp;</td>
              </tr>
              <tr>
                <td style="text-align: center">
                  <p
                    style="
                      font-size: 14px;
                      color: rgba(69, 80, 86, 0.7411764705882353);
                      line-height: 18px;
                      margin: 0 0 0;
                    "
                  >
                    &copy; <strong>https://learning.jawwid.com</strong>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="height: 80px">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!--/100% body table-->
    </body>
  </html>`;

  try {
    await sendEmail({
      email: user.email,
      subject: `${capitalizeFirlstLetterOfName}, Please confirm your account`,
      message: emailTamplate,
    });
    console.log("Email sent");
  } catch (error) {
    console.log(error);
  }

  res.status(201).json({ data: user, token });
});

exports.confirmEmail = asyncHandler(async (req, res, next) => {
  let token = req.params.token;
  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

  let user = await usersModel.findById(decoded.userId);

  if (user.account_status !== "confirmed") {
    user.account_status = "confirmed";
    await user.save();

    res.redirect("https://learning.jawwid.com/");
  } else {
    res.send({ message: "Email already confirmed" });
  }
});

exports.login = asyncHandler(async (req, res, next) => {
  const user = await usersModel.findOne({ email: req.body.email });

  if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
    return next(new ApiError("Incorrect email or password", 401));
  }

  if (user.account_status !== "confirmed") {
    return next(
      new ApiError(
        "Your email is not confirmed, Check your email and click on the confirmation link and then login again",
        401
      )
    );
  } else {
    const token = createToken(user._id, user.role);

    // // Set token in cookies
    // res.cookie("token", token, {
    //   maxAge:  process.env.JWT_EXPIRE_TIME, // Set cookie expiration
    //   httpOnly: true, // Cookie is only accessible via HTTP(S)
    //   secure: req.secure || req.headers["x-forwarded-proto"] === "https", // Set secure flag based on request protocol
    // });

    // Send response with user data and token
    res.status(200).json({ data: user, token });
  }
});

exports.protect = asyncHandler(async (req, res, next) => {
  //1) check if token is exists
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new ApiError("Please login first to access this route", 401));
  }

  //2) verify token (not changed or expired)
  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

  //3) check if user exists
  const currentUser = await usersModel.findById(decoded.userId);

  if (!currentUser) {
    next(new ApiError("user no longer exists for this token", 401));
  }

  //4) check if user changed his password after token is created
  if (currentUser.passwordChangedAT) {
    const passwordChangedTimeStamp = parseInt(
      currentUser.passwordChangedAT.getTime() / 1000,
      10
    );

    // password changed afte token created
    if (passwordChangedTimeStamp > decoded.iat) {
      return next(
        new ApiError("user changed the password. Please login again", 401)
      );
    }
  }

  req.user = currentUser;

  next();
});

exports.allowedTo = (...roles) =>
  asyncHandler(async (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError("you are not allowed to access this route", 403)
      );
    }
    next();
  });

exports.enabledControls = (...scope) =>
  asyncHandler(async (req, res, next) => {
    if (req.user.role == "admin" && !req.user.enabledControls.includes(scope)) {
      return next(
        new ApiError(
          "You don't have the permission to access this. contact the support to enable it.",
          403
        )
      );
    }
    next();
  });

exports.forgetPassword = asyncHandler(async (req, res, next) => {
  //1) Get user by email
  const user = await usersModel.findOne({ email: req.body.email });
  if (!user) {
    return next(
      new ApiError(`No user found for this email:${req.body.email}`, 404)
    );
  }

  //2) if user exists => Generate a random 6 digits code and save it hashed into DB
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedResetCode = crypto
    .createHash("sha256")
    .update(resetCode)
    .digest("hex");

  // save hashed password reset code in DB
  user.passwordResetCode = hashedResetCode;

  // add hashed password reset code expiration time (10 min)
  user.passwordResetCodeExpire = Date.now() + 20 * 60 * 1000;
  user.passwordResetCodeVerified = false;

  await user.save();

  //3) send the reset code by email address
  let capitalizeFirlstLetterOfName =
    user.name.split(" ")[0].charAt(0).toUpperCase() +
    user.name.split(" ")[0].slice(1).toLocaleLowerCase();

    let img ="https://user.jawwid.com/resize/resized/200x60/uploads/company/picture/33387/JawwidLogo.png"


  let emailTamplate = `<!DOCTYPE html>
  <html lang="en-US">
    <head>
      <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
      <title>Reset Password Email</title>
      <meta name="description" content="Reset Password Email" />
      <style type="text/css">
        a:hover {
          text-decoration: underline !important;
        }
      </style>
    </head>
  
    <body
      marginheight="0"
      topmargin="0"
      marginwidth="0"
      style="margin: 0px; background-color: #f2f3f8"
      leftmargin="0"
    >
      <!--100% body table-->
      <table
        cellspacing="0"
        border="0"
        cellpadding="0"
        width="100%"
        bgcolor="#f2f3f8"
        style="
          @import url(https://fonts.googleapis.com/css?family=Rubik:300,400,500,700|Open+Sans:300,400,600,700);
          font-family: 'Open Sans', sans-serif;
        "
      >
        <tr>
          <td>
            <table
              style="background-color: #f2f3f8; max-width: 670px; margin: 0 auto"
              width="100%"
              border="0"
              align="center"
              cellpadding="0"
              cellspacing="0"
            >
              <tr>
                <td style="height: 80px">&nbsp;</td>
              </tr>
              <tr>
                <td style="text-align: center">
                  <a href="https://learning.jawwid.com" title="logo" target="_blank">
                    <img
                      width="250"
                      src=${img}
                      title="logo"
                      alt="logo"
                    />
                  </a>
                </td>
              </tr>
              <tr>
                <td style="height: 20px">&nbsp;</td>
              </tr>
              <tr>
                <td>
                  <table
                    width="95%"
                    border="0"
                    align="center"
                    cellpadding="0"
                    cellspacing="0"
                    style="
                      max-width: 670px;
                      background: #fff;
                      border-radius: 3px;
                      text-align: center;
                      -webkit-box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                      -moz-box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                      box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                    "
                  >
                    <tr>
                      <td style="height: 40px">&nbsp;</td>
                    </tr>
                    <tr>
                      <td style="padding: 0 35px">
                        <h1
                          style="
                            color: #1e1e2d;
                            font-weight: 500;
                            margin: 0;
                            font-size: 30px;
                            font-family: 'Rubik', sans-serif;
                          "
                        >
                          You have requested to reset your password
                        </h1>
                        <span
                          style="
                            display: inline-block;
                            vertical-align: middle;
                            margin: 29px 0 26px;
                            border-bottom: 1px solid #cecece;
                            width: 100px;
                          "
                        ></span>
                        <p
                          style="
                            color: #455056;
                            font-size: 17px;
                            line-height: 24px;
                            margin: 0;
                          "
                        >
                          Hello ${capitalizeFirlstLetterOfName}, \n
                          We received a request to reset the password on your Jaweed account.
                        </p>
                        <p
                          
                          style="
                            text-decoration: none !important;
                            font-weight: 500;
                            margin-top: 35px;
                            color: black;
                            text-transform: uppercase;
                            font-size: 20px;
                            padding: 10px 24px;
                            display: inline-block;
                            border-radius: 50px;
                          "
                          >${resetCode}</p
                        >
                        <p
                          style="
                            color: #455056;
                            font-size: 17px;
                            line-height: 24px;
                            margin: 0;
                          "
                        >
                          Enter this code to complete the reset password process. Please note that this code is only valid for 20 min.
                          
                          Thanks for helping us keep your account secure.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="height: 40px">&nbsp;</td>
                    </tr>
                  </table>
                </td>
              </tr>
  
              <tr>
                <td style="height: 20px">&nbsp;</td>
              </tr>
              <tr>
                <td style="text-align: center">
                  <p
                    style="
                      font-size: 14px;
                      color: rgba(69, 80, 86, 0.7411764705882353);
                      line-height: 18px;
                      margin: 0 0 0;
                    "
                  >
                    &copy; <strong>https://learning.jawwid.com</strong>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="height: 80px">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!--/100% body table-->
    </body>
  </html>
  `;

  try {
    await sendEmail({
      email: user.email,
      subject: `${capitalizeFirlstLetterOfName}, here is your reset code`,
      message: emailTamplate,
    });
  } catch (error) {
    (user.passwordResetCode = undefined),
      (user.passwordResetCodeExpire = undefined);
    user.passwordResetCodeVerified = undefined;

    await user.save();
    console.log(error);
    return next(new ApiError("Sending email failed", 500));
  }

  res
    .status(200)
    .json({ message: "success", status: "reset code sent to email" });
});

exports.verifyPasswordResetCode = asyncHandler(async (req, res, next) => {
  // get user based on password reset code
  const hashedResetCode = crypto
    .createHash("sha256")
    .update(req.body.resetCode)
    .digest("hex");

  const user = await usersModel.findOne({
    passwordResetCode: hashedResetCode,
    passwordResetCodeExpire: { $gt: Date.now() },
  });
  if (!user) {
    return next(new ApiError("Reset code is invalid or expired"));
  }

  // reset code valid
  user.passwordResetCodeVerified = true;
  await user.save();

  res.status(200).json({ message: "success" });
});

exports.resetPassword = asyncHandler(async (req, res, next) => {
  // get user based on email
  const user = await usersModel.findOne({ email: req.body.email });
  if (!user) {
    return next(
      new ApiError(`There is no user with email ${req.body.email}`, 400)
    );
  }

  // check if reset code is verified
  if (!user.passwordResetCodeVerified) {
    return next(new ApiError("Reset code not verified", 400));
  }

  user.password = req.body.newPassword;
  user.passwordResetCode = undefined;
  user.passwordResetCodeExpire = undefined;
  user.passwordResetCodeVerified = undefined;

  await user.save();

  // if everything is good => generate new token
  const token = createToken(user._id, user.role);
  res.status(200).json({ token });
});
