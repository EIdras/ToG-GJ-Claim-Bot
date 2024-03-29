const { SlashCommandBuilder } = require("discord.js");
const fs = require("fs");
const axios = require("axios");
const https = require("https");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("redeemtog")
    .setDescription(
      "Redeem given code for all server users that have registered their ID with the command /registertog."
    )
    .addStringOption((option) =>
      option
        .setName("code")
        .setDescription("The special code to redeem.")
        .setRequired(true)
    )
    .addBooleanOption((option) =>
      option
        .setName("server")
        .setDescription(
          "Whether to redeem the code for all the server members or not (just you)."
        )
        .setRequired(false)
    ),
  async execute(interaction, mongoClient) {
    // Get the MongoDB database and collection
    const db = mongoClient.db("ToGDiscordBot");
    const collection = db.collection("account");

    // Get the code to redeem
    const code = interaction.options.getString("code");
    // Get the server option
    const server = interaction.options.getBoolean("server") ?? false;

    if (!code) {
      await interaction.reply(
        "An error occurred while executing this command."
      );
      console.log("Error: given option is null (wrong name ?)");
      return;
    }

    if (server === false) {
      // Check if the user has already registered a togId
      const existingUser = await collection.findOne({
        userId: interaction.user.id,
      });

      if (existingUser && existingUser.togId.length > 0) {
        // Only redeem the code for the user
        console.log("Redeeming code for user " + interaction.user.id);
        const responses = [];
        for (const togId of existingUser.togId) {
          const message = await sendPostRequest({
            server: "",
            accountID: togId,
            nickname: "",
            couponNumber: code,
          });
          const response = `${interaction.user.tag} (${togId}) -> *${message}*`;
          responses.push(response);
          console.log(` - ${response}`);
        }
        await interaction.reply({
          content: responses.join("\n"),
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "You have not registered a ToG account ID yet.",
          ephemeral: true,
        });
      }
      return;
    }

    // Get the list of all users ID on the server
    const users = await interaction.guild.members
      .fetch()
      .then((members) => members.map((member) => member.user));

    // Find all the codes for the users
    const results = await collection
      .find({ userId: { $in: users.map((user) => user.id) } })
      .toArray();

    // Check if there are any results
    if (results.length === 0) {
      await interaction.reply({
        content: "No user has registered a ToG account ID yet.",
      });
      return;
    }

    const nbUsers = results.length;

// Redeem the code for each user on the server
console.log('Redeeming code for all users on the server:');
await interaction.reply({ content: 'Redeeming code for all users (' + nbUsers + ') on the server . . .'});

let responsePromises = [];
for (const result of results) {
  for (const togId of result.togId) {
    const responsePromise = sendPostRequest({ server: '', accountID: togId, nickname: '', couponNumber: code })
      .then(message => {
        console.log(` - ${users.find(user => user.id === result.userId).tag} -> *${message}* (${togId})`);
        return { message: message, togId: togId, userTag: users.find(user => user.id === result.userId).tag };
      });
    responsePromises.push(responsePromise);
  }
}

const responseObjects = await Promise.all(responsePromises);
let responses = responseObjects.reduce((acc, curr) => {
  let userIndex = acc.findIndex(obj => obj.userTag === curr.userTag);
  if (userIndex !== -1) {
    acc[userIndex].messages.push(`  -> *${curr.message}* (${curr.togId})`);
  } else {
    acc.push({ userTag: curr.userTag, messages: [`  -> *${curr.message}* (${curr.togId})`] });
  }
  return acc;
}, []);

responses = responses.map(resObj => `### ${resObj.userTag}\n${resObj.messages.join('\n')}`);

await interaction.editReply({ content:`**Redeem finished for all users (${nbUsers}) on the server !**\nReport for code \`${code}\` :\n${responses.join('\n')}` });

let replyContent = `**Redeem finished for all users (${nbUsers}) on the server !** time elapsed: \`${(Date.now() - interaction.createdTimestamp) / 1000}s\`\n`;

if (responses.length > 15) {
  const filename = 'redeem_report.txt';
  fs.writeFileSync(filename, responses.join('\n'));
  replyContent += `\nThe redeem report contains too many lines. Please find the report in the attached file.`;
  interaction.editReply({ content: replyContent, files: [filename] });
} else {
  interaction.editReply(replyContent + `\nReport for code \`${code}\` :\n${responses.join('\n')}`);
}
  },
};

// define function to send POST request to ToG API
function sendPostRequest(requestBody) {
  return new Promise((resolve, reject) => {
    const url = "https://global-tog-info.ngelgames.com/api/useCoupon";

    console.log("BODY : " + JSON.stringify(requestBody));
    axios
      .post(url, requestBody, {
        headers: { "Content-Type": "application/json" },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      })
      .then((response) => {
        const data = response.data;
        console.log("DATA : " + JSON.stringify(data));
        const result = data.result;
        const responseType = data.responseType;
        let message = "Unknown error occurred while processing the request.";

        if (result) {
          switch (responseType) {
            case 1:
              message = "**The redeem code is successfully used !**";
              break;
            case 6:
              message = "Error occurred while processing the request.";
              break;
            case 7:
              message = "The account ID must be numbers only.";
              break;
            case 9:
              message =
                "Failed to find your account information. Please double-check your account ID or nickname and try again.";
              break;
            case 14:
              message = "The redeem code is expired.";
              break;
            case 16:
              message = "The redeem code is invalid.";
              break;
            case 20:
              message = "The redeem code is already used.";
              break;
            default:
              message = "Unknown response code.";
              break;
          }
        }

        resolve(message);
      })
      .catch((error) => {
        console.error("Error:", error);
        reject(error);
      });
  });
}
