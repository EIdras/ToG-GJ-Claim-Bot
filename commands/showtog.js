const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('showtog')
    .setDescription('View your registered ToG account IDs.'),
  async execute(interaction, mongoClient) {
    const user = interaction.user;

    // Get the MongoDB database and collection
    const db = mongoClient.db('ToGDiscordBot');
    const collection = db.collection('account');

    // Find the code for the user
    const result = await collection.findOne({ userId: user.id });

    if (result) {
      // Display each togId in a separate line
      const togIdList = result.togId.map(id => `\`${id}\``).join('\n');
      await interaction.reply({ content:`Your registered ToG account IDs are:\n${togIdList}`, ephemeral: true });
    } else {
      await interaction.reply({ content:'You have not registered any ToG account IDs yet.', ephemeral: true });
    }
  },
};
