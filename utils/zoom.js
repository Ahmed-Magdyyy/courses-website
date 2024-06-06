const axios = require("axios");
const moment = require("moment-timezone");

exports.createMeeting = async function (
  topic,
  duration,
  start_date,
  start_time,
  zoom_account_id,
  zoom_client_id,
  zoom_client_Secret
) {
  try {
    const authResponse = await axios.post(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${zoom_account_id}`,
      {},
      {
        auth: {
          username: zoom_client_id,
          password: zoom_client_Secret,
        },
      }
    );

    if (authResponse.status !== 200) {
      console.log("Unable to get access token");
      throw new Error("Unable to get access token")
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
    const formattedStartTime = formattedDateTime.utc().format(
      "YYYY-MM-DDTHH:mm:ss[Z]"
    );

    console.log("formattedStartTime:", new Date(formattedStartTime));
    
    const payload = {
      topic: topic,
      duration: duration,
      start_time: new Date(formattedStartTime),
      timezone: "UTC",
      type: 2,
    };

    const meetingResponse = await axios.post(
      `https://api.zoom.us/v2/users/me/meetings`,
      payload,
      { headers }
    );
    if (meetingResponse.status !== 201) {
      console.log("Unable to generate meeting link");
      throw new Error("Unable to generate meeting link")
    }

    const response_data = meetingResponse.data;
    const content = {
      meeting_url: response_data.join_url,
      password: response_data.password,
      meetingTime: response_data.start_time,
      // meetingTime: moment(response_data.start_time)
      //   .add(2, "hours")
      //   .toISOString(),
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

exports.deleteMeeting = async function (
  meetingId,
  zoom_account_id,
  zoom_client_id,
  zoom_client_Secret
) {
  try {

    // Authenticate with Zoom to get access token
    const authResponse = await axios.post(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${zoom_account_id}`,
      {},
      {
        auth: {
          username: zoom_client_id,
          password: zoom_client_Secret,
        },
      }
    );

    if (authResponse.status !== 200) {
      console.log("Unable to get access token");
      throw new Error("Unable to get access token")
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
      throw new Error("Unable to delete meeting from Zoom")

    } else {
      console.log("Meeting deleted successfully from Zoom");
      return "Meeting deleted successfully from Zoom";
    }
  } catch (error) {
    console.error("Error deleting meeting from Zoom:", error.data);
  }
};
