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
      meeting_uuid: response_data.uuid,
      meetingId: response_data.id,
      host_id: response_data.host_id,
      host_email: response_data.host_email,      
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

exports.deleteMeeting = async function (meetingId) {
  try {
    // Authenticate with Zoom to get access token
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

    // Set headers for Zoom API request
    const headers = {
      Authorization: `Bearer ${access_token}`,
    };

    // Delete meeting from Zoom using its ID
    const response = await axios.delete(
      `https://api.zoom.us/v2/meetings/${meetingId}`,
      {
        headers,
      }
    );

    if (response.status !== 204) {
      console.log("Unable to delete meeting from Zoom");
      return "Unable to delete meeting from Zoom"
    } else {
      console.log("Meeting deleted successfully from Zoom");
      return "Meeting deleted successfully from Zoom"
    }
  } catch (error) {
    console.error("Error deleting meeting from Zoom:", error.data);
  }
}
