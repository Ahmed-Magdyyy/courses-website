const account_id = process.env.Account_ID;
const client_secret = process.env.Client_Secret;
const client_ID = process.env.Client_ID;

exports.matchZoomAccount = (email) => {
  switch (email) {
    case "bohy.ahmed@gmail.com":
      return {
        accountID: process.env.Account_ID,
        auth: {
          username: process.env.Client_ID,
          password: process.env.Client_Secret,
        },
      };

    case "bohy00ahmed@gmail.com":
      return {
        accountID: process.env.Account_ID_TWO,
        auth: {
          username: process.env.Client_ID_TWO,
          password: process.env.Client_Secret_TWO,
        },
      };

    case "developytech@gmail.com":
      return {
        accountID: process.env.Account_ID_fares,
        auth: {
          username: process.env.Client_ID_fares,
          password: process.env.Client_Secret_fares,
        },
      };
  }
};
