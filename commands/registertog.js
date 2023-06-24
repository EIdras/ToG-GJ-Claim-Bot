const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("registertog")
    .setDescription("Register your ToG account ID.")
    .addStringOption((option) =>
      option
        .setName("togid")
        .setDescription("Your Tower of God: Great Journey account ID.")
        .setRequired(true)
    )
    .addBooleanOption((option) =>
      option
        .setName("delete")
        .setDescription("Delete the ToG account ID from your list.")
        .setRequired(false)
    ),
  async execute(interaction, mongoClient) {
    const user = interaction.user;
    const togId = interaction.options.getString("togid");
    const deleteOpt = interaction.options.getBoolean("delete") || false;
    if (!togId) {
      await interaction.reply(
        "An error occurred while executing this command."
      );
      console.log("Error: given option is null (wrong name ?)");
      return;
    }

    // Check if the togId is valid. It should be 8 characters long and only contain numbers.
    if (togId.length !== 8 || !/^\d+$/.test(togId)) {
      await interaction.reply({
        content: "The given ToG account ID is invalid. Please try again.",
        ephemeral: true,
      });
      return;
    }

    // Get the MongoDB database and collection
    const db = mongoClient.db("ToGDiscordBot");
    const collection = db.collection("account");

    // If the user is not trying to delete an ID, check if the togId is already registered by another user
    if (!deleteOpt) {
      const existingId = await collection.findOne({
        userId: { $ne: user.id },
        togId: { $elemMatch: { $eq: togId } },
      });
      if (existingId) {
        return await interaction.reply({
          content: `The ToG account ID \`${togId}\` is already registered by another user.`,
          ephemeral: true,
        });
      }
    }

    // Check if the user has already registered a togId
    const existingUser = await collection.findOne({ userId: user.id });

    if (existingUser) {
      if (deleteOpt) {
        // Check if the togId is already in the array
        if (!existingUser.togId.includes(togId)) {
          await interaction.reply({
            content:
              "This ToG account ID does not exist in your registered list.",
            ephemeral: true,
          });
          return;
        }

        // Deleting togId from existing user's togId array
        await collection.updateOne(
          { userId: user.id },
          { $pull: { togId: togId } }
        );

        await interaction.reply(
          "Your ToG account ID has been deleted successfully."
        );
        console.log(`Deleted ToG account ID ${togId} from user ${user.tag}`);
      } else {
        // Adding togId to existing user's togId array
        await collection.updateOne(
          { userId: user.id },
          { $push: { togId: togId } }
        );

        await interaction.reply(
          "Your new ToG account ID has been added successfully."
        );
        console.log(`Added new ToG account ID ${togId} to user ${user.tag}`);
      }
    } else {
      if (deleteOpt) {
        await interaction.reply({
          content: `You don't have any registered ToG account IDs to delete.`,
          ephemeral: true,
        });
      } else {
        // Insert the togId into the collection as an array
        await collection.insertOne({ userId: user.id, togId: [togId] });

        await interaction.reply(
          "Your ToG account ID has been registered successfully."
        );
        console.log(`Registered ${user.tag}'s ToG account ID as ${togId}`);
      }
    }
  },
};
