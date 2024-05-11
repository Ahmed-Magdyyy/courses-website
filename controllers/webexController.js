const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const axios = require("axios");

// exports.authorize = () => {
//   return `https://webexapis.com/v1/authorize?client_id=${process.env.WEBEX_CLIENT_ID}&response_type=code&redirect_uri=${process.env.WEBEX_REDIRECT_URI}&scope=${process.env.WEBEX_SCOPE_LIST}`;
// };
// exports.redirect = () => {
//   return ``;
// };

exports.authorize = asyncHandler(async (req, res, next) => {
  const webexAuthUrl = `https://webexapis.com/v1/authorize?client_id=C92232adad92d118df1315f2743475c8c7a3c62ff7dc623731aa9227c64bd67d6&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fv1%2Fwebex%2Fauthorize%2Fcallback&scope=guest-meeting%3Arw%20identity%3Agroups_read%20identity%3Agroups_rw%20identity%3Apeople_read%20identity%3Apeople_rw%20identity%3Atokens_read%20identity%3Atokens_write%20meeting%3Aadmin_config_read%20meeting%3Aadmin_config_write%20meeting%3Aadmin_participants_read%20meeting%3Aadmin_preferences_read%20meeting%3Aadmin_preferences_write%20meeting%3Aadmin_recordings_read%20meeting%3Aadmin_recordings_write%20meeting%3Aadmin_schedule_read%20meeting%3Aadmin_schedule_write%20meeting%3Aadmin_transcripts_read%20meeting%3Acontrols_read%20meeting%3Acontrols_write%20meeting%3Aparticipants_read%20meeting%3Aparticipants_write%20meeting%3Apreferences_read%20meeting%3Apreferences_write%20meeting%3Arecordings_read%20meeting%3Arecordings_write%20meeting%3Aschedules_read%20meeting%3Aschedules_write%20meeting%3Atranscripts_read%20spark%3Akms&state=set_state_here`;
  // console.log("webexAuthUrl", webexAuthUrl)


  

  res.redirect(webexAuthUrl);
})

exports.callBack = asyncHandler(async (req, res, next) => {
const {code} = req.query

const tokenResponse = await axios.post('https://webexapis.com/v1/access_token', {
  client_id: process.env.WEBEX_CLIENT_ID,
  client_secret: process.env.WEBEX_CLIENT_SECRET,
  code: code,
  grant_type: 'authorization_code',
  redirect_uri: process.env.WEBEX_REDIRECT_URI
});

console.log("tokenResponse", tokenResponse)

});

// exports.authorizee = asyncHandler(async (req, res, next) => {
//   return res.json(redirect(req.query.code));
// });
// exports.redirectt = asyncHandler(async (req, res, next) => {
//   return res.json(redirect(req.query.code));
// });
