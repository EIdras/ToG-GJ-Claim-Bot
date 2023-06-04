const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('showtog')
    .setDescription('View your registered ToG account ID.'),
  async execute(interaction, mongoClient) {
    const user = interaction.user;

    // Get the MongoDB database and collection
    const db = mongoClient.db('ToGDiscordBot');
    const collection = db.collection('account');

    // Find the code for the user
    const result = await collection.findOne({ userId: user.id });

    if (result) {
      await interaction.reply({ content:`Your registered ToG account ID is: \`${result.togId}\``, ephemeral: true });
    } else {
      await interaction.reply({ content:'You have not registered a ToG account ID yet.', ephemeral: true });
    }
  },
};
