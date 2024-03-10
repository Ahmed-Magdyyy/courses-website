const axios = require("axios");
const moment = require("moment-timezone");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");


const account_id = process.env.Account_ID;
const client_secret = process.env.Client_Secret;
const client_ID = process.env.Client_ID;

exports.getAccessToken = async () => {
  try {
    const response = await axios.post(
      "https://zoom.us/oauth/token",
      {
        grant_type: "client_credentials",
      },
      {
        auth: {
          username: client_ID,
          password: client_secret,
        },
      }
    );

    if (response.status === 200) {
      return response.data.access_token;
    } else {
      throw new Error("Failed to obtain access token");
    }
  } catch (error) {
    console.error("Error obtaining access token:", error);
    throw error;
  }
};

exports.getUserZoomInfo = (email) =>
  asyncHandler(async (req, res, next) => {
    try {
      const response = await axios.post(
        "https://zoom.us/oauth/token",
        {
          grant_type: "client_credentials",
        },
        {
          auth: {
            username: client_ID,
            password: client_secret,
          },
        }
      );

      if (response.status === 200) {
        console.log("token is:", response.data.access_token);
      } else {
       new ApiError("Failed to obtain access token");
      }
    } catch (error) {
      console.error("Error obtaining access token:", error);
      ApiError( error);
    }

    try {
      // Retrieve Zoom user information based on the provided email
      const accessToken = response.data.access_token; // Replace 'your_access_token' with your actual Zoom API access token
      const userInfo = await getZoomUserInfo(accessToken, email);

      // Add the Zoom user information to the request object
      req.zoomUserInfo = userInfo;

      // Proceed to the next middleware or route handler
      next();
    } catch (error) {
      console.error("Error retrieving Zoom user information:", error);
      res.status(500).json({ error: "Error retrieving Zoom user information" });
    }

    async function getZoomUserInfo(accessToken, email) {
      try {
        const response = await axios.get(
          `https://api.zoom.us/v2/users?email=${email}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        console.log(response.data);

        if (
          response.data &&
          response.data.users &&
          response.data.users.length > 0
        ) {
          return response.data.users[0]; // Return the first user found (assuming unique emails)
        } else {
          throw new Error("User not found with the specified email");
        }
      } catch (error) {
        console.error("Error retrieving Zoom user information:", error);
        throw error;
      }
    }
  });
