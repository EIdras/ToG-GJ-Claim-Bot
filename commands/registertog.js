const { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('registertog')
    .setDescription('Register your ToG account ID.')
    .addStringOption(option =>
      option
        .setName('togid')
        .setDescription('Your Tower of God: Great Journey account ID.')
        .setRequired(true)
    ),
  async execute(interaction, mongoClient) {
    const user = interaction.user;
    const togId = interaction.options.getString('togid');
    if (!togId) {
      await interaction.reply('An error occurred while executing this command.');
      console.log('Error: given option is null (wrong name ?)');
      return;
    }

    // Check if the togId is valid. It should be 8 characters long and only contain numbers.
    if (togId.length !== 8 || !/^\d+$/.test(togId)) {
      await interaction.reply({ content: 'The given ToG account ID is invalid. Please try again.', ephemeral: true });
      return;
    }

    // Get the MongoDB database and collection
    const db = mongoClient.db('ToGDiscordBot');
    const collection = db.collection('account');

    // Check if the user has already registered a togId
    const existingUser = await collection.findOne({ userId: user.id });

    if (existingUser) {

      // Check if the togid is the same as the one already registered
      if (existingUser.togId === togId) {
        await interaction.reply({ content: 'You have already registered this ToG account ID.', ephemeral: true });
        return;
      }

    const confirm = new ButtonBuilder()
			.setCustomId('replace')
			.setLabel('Replace')
			.setStyle(ButtonStyle.Primary);

		const cancel = new ButtonBuilder()
			.setCustomId('cancel')
			.setLabel('Cancel')
			.setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder()
			.addComponents(cancel, confirm);

      await interaction.reply({ content: 'You have already registered a ToG account ID. Would you like to replace it ?\n\`' + existingUser.togId +'\` -> \`' + togId + '\`', components: [row], ephemeral: true});

      const filter = i => i.user.id === user.id;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

      collector.on('collect', async i => {
        if (i.customId === 'replace') {
          // Replace the togId in the collection
          await collection.updateOne({ userId: user.id }, { $set: { togId: togId } });

          await interaction.editReply('Your ToG account ID has been replaced successfully.');
        } else if (i.customId === 'cancel') {
          await interaction.editReply('Your ToG account ID has not been replaced.');
        }
        collector.stop();
      });

      collector.on('end', async () => {
        // Remove the buttons after the interaction ends
        await interaction.editReply({ components: [] });
        // If the interaction ended without a button being pressed (timeout), send a message
        if (collector.endReason === 'time') {
          await interaction.followUp({ content: 'Timed out. Your ToG account ID has not been replaced.', ephemeral: true });
        }
      });
    } else {
      // Insert the togId into the collection
      await collection.insertOne({ userId: user.id, togId: togId });

      await interaction.reply('Your ToG account ID has been registered successfully.');
      console.log(`Registered ${user.tag}'s ToG account ID as ${togId}`);
    }
  },
};
