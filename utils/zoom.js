const axios = require("axios");
const moment = require("moment-timezone");

const account_id = process.env.Account_ID;
const client_secret = process.env.Client_Secret;
const client_ID = process.env.Client_ID;

exports.createMeeting = async function (
  topic,
  duration,
  start_date,
  start_time
) {
  try {
    const authResponse = await axios.post(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${account_id}`,
      {},
      {
        auth: {
          username: client_ID,
          password: client_secret,
        },
      }
    );

    if (authResponse.status !== 200) {
      console.log("Unable to get access token");
      return;
    }

    const access_token = authResponse.data.access_token;

    const headers = {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    };

    // Combine start_date and start_time to form a datetime string
    const datetimeString = `${start_date} ${start_time}`;

    // Parse the datetime string with the specified format
    const formattedDateTime = moment(datetimeString, "DD-MM-YYYY h:mm A");

    // Format the datetime as needed
    const formattedStartTime = formattedDateTime.format(
      "YYYY-MM-DDTHH:mm:ss[Z]"
    );

    const payload = {
      topic: topic,
      duration: duration,
      start_time: new Date(formattedStartTime),
      timezone: "Africa/Cairo",
      type: 2,
    };

    const meetingResponse = await axios.post(
      `https://api.zoom.us/v2/users/me/meetings`,
      payload,
      { headers }
    );

    if (meetingResponse.status !== 201) {
      console.log("Unable to generate meeting link");
      return;
    }

    const response_data = meetingResponse.data;

    const content = {
      meeting_url: response_data.join_url,
      password: response_data.password,
      meetingTime: response_data.start_time,
      topic: response_data.topic,
      duration: response_data.duration,
      message: "Success",
      status: 1,
    };

    return content;
  } catch (error) {
    console.error(error);
    return error;
  }
};
