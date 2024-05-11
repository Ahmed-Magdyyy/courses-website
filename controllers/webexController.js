const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const axios = require("axios");
const moment = require("moment-timezone");

let webex_access_token = "";

exports.authorize = asyncHandler(async (req, res, next) => {
  const webexAuthUrl = `https://webexapis.com/v1/authorize?client_id=${process.env.WEBEX_CLIENT_ID}&response_type=code&redirect_uri=${process.env.WEBEX_REDIRECT_URI}&scope=${process.env.WEBEX_SCOPE_LIST}`;
  // console.log("webexAuthUrl", webexAuthUrl)

  res.redirect(webexAuthUrl);
});

exports.callBack = asyncHandler(async (req, res, next) => {
  const { code } = req.query;

  const tokenResponse = await axios.post(
    "https://webexapis.com/v1/access_token",
    {
      client_id: process.env.WEBEX_CLIENT_ID,
      client_secret: process.env.WEBEX_CLIENT_SECRET,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: process.env.WEBEX_REDIRECT_URI,
    }
  );

  console.log("tokenResponse", tokenResponse.data);
  const { access_token, expires_in, refresh_token } = tokenResponse.data;
  webex_access_token = access_token;
  res.status(200).json({ access_token, expires_in, refresh_token });
});

exports.createMeeting = asyncHandler(async (req, res, next) => {
  const {
    title,
    duration,
    start_date,
    start_time,
    end_date,
    end_time,
    hostEmail,
  } = req.body;

  // Combine start_date and start_time to form a datetime string
  const datetimeString = `${start_date} ${start_time}`;
  const endDatetimeString = `${end_date} ${end_time}`;

  // Parse the datetime string with the specified format
  const formattedDateTime = moment(datetimeString, "DD-MM-YYYY h:mm A");
  const formattedEndDateTime = moment(endDatetimeString, "DD-MM-YYYY h:mm A");

  // Format the datetime as needed
  const formattedStartTime = formattedDateTime.format("YYYY-MM-DDTHH:mm:ss[Z]");
  const formattedEndTime = formattedEndDateTime.format(
    "YYYY-MM-DDTHH:mm:ss[Z]"
  );

  const meetingData = {
    title: title,
    start: new Date(formattedStartTime),
    end: new Date(formattedEndTime),
    // timezone: "Africa/Cairo",
    hostEmail,
  };

  console.log("DATA:", meetingData);

  const accessToken = req.headers.authorization.split(" ")[1];
  console.log("accessToken", accessToken);

try {
    // Make a POST request to create the meeting
    const response = await axios.post(
      "https://webexapis.com/v1/meetings",
      meetingData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("response:", response.data);
  
    res.status(200).json("success");
} catch (error) {
  console.log("error", error.response.data)
  res.status(500).json(error);

}
});
