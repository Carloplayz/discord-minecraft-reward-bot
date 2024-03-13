const { Client, GatewayIntentBits, REST, Routes } = require('discord.js'); // Import REST and Routes
const mysql = require('mysql');
const fs = require('fs');
const Rcon = require('rcon-client').Rcon;

function loadConfigFromFile(filePath) {
  const rawConfig = fs.readFileSync(filePath);
  return JSON.parse(rawConfig);
}
const configFilePaths = ['config/discord_config.json', 'config/mysql_config.json', 'config/rcon_config.json', 'config/reward_config.json'];
const config = configFilePaths.reduce((mergedConfig, filePath) => {
  const fileConfig = loadConfigFromFile(filePath);
  return { ...mergedConfig, ...fileConfig };
}, {});

const bot_token = config.bot_token;
const allowedChannelId = config.allowedChannelId;
const logChannelId = config.logChannelId;
const adminRoleId = config.adminRoleId;
const host = config.databaseHost;
const user = config.databaseUser;
const password = config.databasePassword;
const database = config.databaseName;
const rconhost = config.host;
const rconport = config.port;
const rconpassword = config.password;
const dailyprefix = config.dailyprefix;
const dailysuffix = config.dailysuffix;
const weeklyprefix = config.weeklyprefix;
const weeklysuffix = config.weeklysuffix;
const monthlyprefix = config.monthlyprefix;
const monthlysuffix = config.monthlysuffix;
const allow = config.onlyAllowedInChannel;
const cooldownTime = 72 * 60 * 60 * 1000;

if (allow !== 'true' && allow !== 'false'){
  console.log('error in discord_config file');
  console.log('Exiting...');
  setTimeout(() => {
    process.exit();
  }, 1500);
}

const dbConfig = {
  host: host,
  user: user,
  password: password,
  database: database
};
const db = mysql.createConnection(dbConfig);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});


client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, member, options, guild, channel } = interaction; // Define 'member' here
  const discordId = member.id; // Use 'member' instead of 'member.id'

  if (channel.id !== allowedChannelId && allow === 'true') {
    const allowedChannel = guild.channels.cache.get(allowedChannelId);
    await interaction.reply({ content: `Commands can only be used in ${allowedChannel}.`, ephemeral: true });
    return;
  }

  switch (commandName) {
    case 'setusername':
      const newUsername = interaction.options.getString('username');
      await setMinecraftUsername(discordId, newUsername, interaction, guild, logChannelId);
      break;
    case 'changeusername':
      const newMinecraftUsername = interaction.options.getString('username');
      await changeMinecraftUsername(discordId, newMinecraftUsername, interaction, guild, logChannelId);
      break;
    case 'getusername':
      await getMinecraftUsername(discordId, interaction);
      break;
    case 'claimdaily':
      await daily(interaction, rconhost, rconport, rconpassword, logChannelId, dailyprefix, dailysuffix);
      break;
    case 'claimweekly':
      await claimWeekly(interaction, rconhost, rconport, rconpassword, logChannelId, weeklyprefix, weeklysuffix);
      break;
    case 'claimmonthly':
      await claimMonthly(interaction, rconhost, rconport, rconpassword, logChannelId, monthlyprefix, monthlysuffix);
      break;
    case 'list':
      if (!member.roles.cache.has(adminRoleId)) {
        await interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });
        return;
      }
      await listUsernames(interaction);
      break;
    case 'resetcooldown':
      if (!member.roles.cache.has(adminRoleId)) {
        await interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });
        return;
      }
      const targetDiscordId = options.getString('discord_id');
      const cooldownType = options.getString('cooldown_type').toLowerCase(); // assuming cooldown_type is provided as 'daily', 'weekly', or 'monthly'

      // Reset the specified cooldown for the user
      resetCooldown(targetDiscordId, cooldownType, interaction);
      break;
    case 'deldata':
      const discordIdsToDelete = options.getString('discord_id').split(/\s+/); // Split by whitespace
      if (!member.roles.cache.has(adminRoleId)) {
        await interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });
        return;
      }
      await deleteDataFromDatabase(discordIdsToDelete, interaction);
      break;
    case 'resetdatabase':
      if (!member.roles.cache.has(adminRoleId)) {
        await interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });
        return;
      }
      await resetDatabase(interaction);
      break;
  }
});

connectWithRetry();
scheduleDailyReset(client, logChannelId);

async function setMinecraftUsername(discordId, username, interaction, guild, channelId) {
  // Check if the user already has a Minecraft username set
  db.query('SELECT minecraft_username FROM users WHERE discord_id = ?', [discordId], async (error, results) => {
    if (error) {
      console.error(error);
      return;
    }

    if (results.length > 0) {
      // User already has a Minecraft username set
      await interaction.reply({ content: "You have already set your Minecraft username.", ephemeral: true });
    } else {
      // Proceed to set the new username
      db.query('INSERT INTO users (discord_id, minecraft_username, last_change) VALUES (?, ?, ?)', [discordId, username, Date.now()], async (error, results) => {
        if (error) {
          console.error(error);
          return;
        }
        await interaction.reply({ content: `Your Minecraft username has been set to **${username}**.`, ephemeral: true });
      });

      // Log the set username action
      const logChannel = guild.channels.cache.get(channelId);
      if (logChannel) {
        logChannel.send(`User <@${discordId}> set their Minecraft username to **${username}**.`);
      }
    }
  });
}

async function changeMinecraftUsername(discordId, newUsername, interaction, guild, channelId) {
  const currentTime = Date.now();

  db.query('SELECT last_change, minecraft_username FROM users WHERE discord_id = ?', [discordId], async (error, results) => {
    if (error) {
      console.error(error);
      return;
    }

    if (results.length > 0) {
      const lastChange = results[0].last_change;

      db.query('SELECT minecraft_username FROM users WHERE minecraft_username = ?', [newUsername], async (error, results) => {
        if (error) {
          console.error(error);
          return;
        }

        if (results.length > 0) {
          // Username already in use by another user
          await interaction.reply({ content: `Sorry, the username **${newUsername}** is already in use by another user.`, ephemeral: true });
        } else {
          if (!lastChange || currentTime - lastChange >= cooldownTime) {
            db.query('INSERT INTO users (discord_id, minecraft_username, last_change) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE minecraft_username = VALUES(minecraft_username), last_change = VALUES(last_change)', [discordId, newUsername, currentTime], async (error, results) => {
              if (error) {
                console.error(error);
                return;
              }
              await interaction.reply({ content: `Your Minecraft username has been changed to **${newUsername}**.`, ephemeral: true });
            });

            // Log the change username action
            const logChannel = guild.channels.cache.get(channelId);
            if (logChannel) {
              logChannel.send(`User <@${discordId}> changed their Minecraft username from **${results[0].minecraft_username}** to **${newUsername}**.`);
            }
          } else {
            const remainingTime = cooldownTime - (currentTime - lastChange);
            const hours = Math.floor(remainingTime / (1000 * 60 * 60));
            const minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
            await interaction.reply({ content: `You can change your Minecraft username again in **${hours} hours and ${minutes} minutes**.`, ephemeral: true });
          }
        }
      });
    } else {
      await interaction.reply({ content: "You haven't set your Minecraft username yet.", ephemeral: true });
    }
  });
}

async function getMinecraftUsername(discordId, interaction) {
  db.query('SELECT minecraft_username FROM users WHERE discord_id = ?', [discordId], async (error, results) => {
    if (error) {
      console.error(error);
      return;
    }

    if (results.length > 0) {
      await interaction.reply({ content: `Your current Minecraft username is **${results[0].minecraft_username}**.`, ephemeral: true });
    } else {
      await interaction.reply({ content: "You haven't set your Minecraft username yet.", ephemeral: true });
    }
  });
}

async function listUsernames(interaction) {
  // Implement logic to fetch usernames from your database
  db.query('SELECT discord_id, minecraft_username FROM users', async (error, results) => {
    if (error) {
      console.error(error);
      await interaction.reply({ content: "An error occurred while fetching usernames. If this problem continues please inform <@845537211076444180>", ephemeral: true });
      return;
    }

    if (results.length > 0) {
      const userList = results.map(row => `Discord ID: <@${row.discord_id}>, Minecraft Username: ${row.minecraft_username}`).join('\n');
      await interaction.reply({ content: `List of users and their Minecraft usernames:\n${userList}`, ephemeral: true });
    } else {
      await interaction.reply({ content: "No users found.", ephemeral: true });
    }
  });
}

async function sendCommand(rconhost, rconport, rconpassword, command, logChannelId, interaction) {
  try {
    // Connect to RCON
    const rcon = await Rcon.connect({
      host: rconhost,
      port: rconport,
      password: rconpassword
    });

    // Send command via RCON
    const response = await rcon.send(command);

    // Remove Minecraft color codes from response
    const responseWithoutColors = removeColorCodes(response);

    // Log the response data in the log channel without color codes
    const logChannel = interaction.guild.channels.cache.get(logChannelId);
    if (logChannel) {
      logChannel.send(responseWithoutColors);
    }

    // Close RCON connection
    await rcon.end();

    return responseWithoutColors;
  } catch (error) {
    console.error("Error sending command via RCON:", error);
    throw error;
  }
}

async function daily(interaction, rconhost, rconport, rconpassword, logChannelId, dailyprefix, dailysuffix) {
  const discordId = interaction.member.id;

  // Check if the user has set a Minecraft username
  db.query('SELECT minecraft_username, daily_claim FROM users WHERE discord_id = ?', [discordId], async (error, results) => {
    if (error) {
      console.error(error);
      await interaction.reply({ content: "An error occurred while processing your request. If this problem continues please inform <@845537211076444180>", ephemeral: true });
      return;
    }

    if (results.length === 0 || !results[0].minecraft_username) {
      await interaction.reply({ content: "You need to set your Minecraft username first.", ephemeral: true });
      return;
    }

    const minecraftUsername = results[0].minecraft_username;
    const dailyClaimed = results[0].daily_claim;

    if (dailyClaimed) {
      await interaction.reply({ content: "You have **already claimed** your **daily** reward.", ephemeral: true });
      return;
    }

    // Construct the command to be sent to the RCON server
    const command = dailyprefix + minecraftUsername + dailysuffix;

    try {
      // Use sendCommand function
      const commandSent = await sendCommand(rconhost, rconport, rconpassword, command, logChannelId, interaction);

      if (commandSent) {
        // Mark daily_claim as TRUE only after receiving successful response from RCON server
        db.query('UPDATE users SET daily_claim = 1 WHERE discord_id = ?', [discordId], async (error) => {
          if (error) {
            console.error(error);
            await interaction.reply({ content: "An error occurred while processing your request. If this problem continues please inform <@845537211076444180>", ephemeral: true });
            return;
          }
          // Provide reward (replace this with your reward logic)
          await interaction.reply(`Claimed **daily** reward for **${minecraftUsername}** !`);
        });
      }
    } catch (error) {
      console.error("Error processing daily command:", error);
      await interaction.reply({ content: "An error occurred while processing your request. If this problem continues please inform <@845537211076444180>", ephemeral: true });
    }
  });
}

async function claimWeekly(interaction, rconhost, rconport, rconpassword, logChannelId, weeklyprefix, weeklysuffix) {
  const discordId = interaction.member.id;
  const currentTime = Date.now();
  const weeklyCooldown = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  // Check if the user has set a Minecraft username
  db.query('SELECT minecraft_username, last_weekly_claim FROM users WHERE discord_id = ?', [discordId], async (error, results) => {
    if (error) {
      console.error(error);
      await interaction.reply({ content: "An error occurred while processing your request. If this problem continues please inform <@845537211076444180>", ephemeral: true });
      return;
    }

    if (results.length === 0 || !results[0].minecraft_username) {
      await interaction.reply({ content: "You need to set your Minecraft username first.", ephemeral: true });
      return;
    }

    const lastWeeklyClaim = results[0].last_weekly_claim;

    if (lastWeeklyClaim && currentTime - lastWeeklyClaim < weeklyCooldown) {
      const remainingTime = weeklyCooldown - (currentTime - lastWeeklyClaim);
      const remainingHours = Math.ceil(remainingTime / (60 * 60 * 1000));
      await interaction.reply({ content: `You can claim your **weekly** reward again in **${remainingHours} hours.**`, ephemeral: true });
    } else {
      const minecraftUsername = results[0].minecraft_username;
      const command = weeklyprefix + minecraftUsername + weeklysuffix;

      try {
        // Use sendCommand function
        const response = await sendCommand(rconhost, rconport, rconpassword, command, logChannelId, interaction);

        // Mark weekly claim as true and update last claim timestamp in the database
        db.query('UPDATE users SET last_weekly_claim = ? WHERE discord_id = ?', [currentTime, discordId], async (error) => {
          if (error) {
            console.error(error);
            await interaction.reply({ content: "An error occurred while processing your request. If this problem continues please inform <@845537211076444180>", ephemeral: true });
            return;
          }
          // Provide reward (replace this with your reward logic)
          await interaction.reply(`Claimed **weekly** reward for **${minecraftUsername}** !`);
        });
      } catch (error) {
        console.error("Error processing weekly command:", error);
        await interaction.reply({ content: "An error occurred while processing your request. If this problem continues please inform <@845537211076444180>", ephemeral: true });
      }
    }
  });
}

async function claimMonthly(interaction, rconhost, rconport, rconpassword, logChannelId, monthlyprefix, monthlysuffix) {
  const discordId = interaction.member.id;
  const currentTime = Date.now();
  const monthlyCooldown = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

  // Check if the user has set a Minecraft username
  db.query('SELECT minecraft_username, last_monthly_claim FROM users WHERE discord_id = ?', [discordId], async (error, results) => {
    if (error) {
      console.error(error);
      await interaction.reply({ content: "An error occurred while processing your request. If this problem continues please inform <@845537211076444180>", ephemeral: true });
      return;
    }

    if (results.length === 0 || !results[0].minecraft_username) {
      await interaction.reply({ content: "You need to set your Minecraft username first.", ephemeral: true });
      return;
    }

    const lastMonthlyClaim = results[0].last_monthly_claim;

    if (lastMonthlyClaim && currentTime - lastMonthlyClaim < monthlyCooldown) {
      const remainingTime = monthlyCooldown - (currentTime - lastMonthlyClaim);
      const remainingDays = Math.ceil(remainingTime / (24 * 60 * 60 * 1000));
      await interaction.reply({ content: `You can claim your **monthly** reward again in **${remainingDays}** days.`, ephemeral: true });
    } else {
      const minecraftUsername = results[0].minecraft_username;
      const command = monthlyprefix + minecraftUsername + monthlysuffix;

      try {
        // Use sendCommand function
        const response = await sendCommand(rconhost, rconport, rconpassword, command, logChannelId, interaction);

        // Mark monthly claim as true and update last claim timestamp in the database
        db.query('UPDATE users SET last_monthly_claim = ? WHERE discord_id = ?', [currentTime, discordId], async (error) => {
          if (error) {
            console.error(error);
            await interaction.reply({ content: "An error occurred while processing your request. If this problem continues please inform <@845537211076444180>", ephemeral: true });
            return;
          }
          // Provide reward (replace this with your reward logic)
          await interaction.reply(`Claimed **monthly** reward for **${minecraftUsername}** !`);
        });
      } catch (error) {
        console.error("Error processing monthly command:", error);
        await interaction.reply({ content: "An error occurred while processing your request. If this problem continues please inform <@845537211076444180>", ephemeral: true });
      }
    }
  });
}

function removeColorCodes(input) {
  return input.replace(/§[0-9a-fklmnor]/g, '');
}

function deleteDataFromDatabase(discordIds, interaction, logChannelId) {
  // Implement logic to delete data from the database based on Discord IDs
  const query = "DELETE FROM users WHERE discord_id IN (?)";
  db.query(query, [discordIds], (error, results) => {
    if (error) {
      console.error("Error deleting data from database:", error);
      interaction.reply({ content: "An error occurred while deleting data from the database.", ephemeral: true });
    } else {
      const affectedRows = results.affectedRows || 0;
      interaction.reply({ content: `Successfully deleted ${affectedRows} record(s) from the database.`, ephemeral: true });
      
      // Log the delete data action in the log channel
      const logChannel = interaction.guild.channels.cache.get(logChannelId);
      if (logChannel) {
        logChannel.send(`Deleted ${affectedRows} record(s) from the database.`);
      } else {
        console.error("Log channel not found.");
      }
    }
  });
}

function resetDatabase(interaction, logChannelId) {
  // Implement logic to reset the entire database
  db.query("DELETE FROM users", (error, results) => {
    if (error) {
      console.error("Error resetting database:", error);
      interaction.reply({ content: "An error occurred while resetting the database.", ephemeral: true });
    } else {
      const affectedRows = results.affectedRows || 0;
      interaction.reply({ content: `Successfully cleared ${affectedRows} record(s) from the database.`, ephemeral: true });
      
      // Log the reset database action in the log channel
      const logChannel = interaction.guild.channels.cache.get(logChannelId);
      if (logChannel) {
        logChannel.send(`Reset the entire database. Cleared ${affectedRows} record(s) from the database.`);
      } else {
        console.error("Log channel not found.");
      }
    }
  });
}

async function resetCooldown(targetDiscordId, cooldownType, interaction, logChannelId) {
  try {
    if (['daily', 'weekly', 'monthly'].includes(cooldownType)) {
      const cooldownColumn = `last_${cooldownType}_claim`;
      if (cooldownType === 'daily') {
        db.query(`UPDATE users SET daily_claim = 0 WHERE discord_id = ?`, [targetDiscordId], async (error) => {
          if (error) {
            console.error(error);
            await interaction.reply({ content: "An error occurred while resetting the cooldown.", ephemeral: true });
            return;
          }
          await interaction.reply({ content: `${cooldownType} cooldown reset for user with Discord ID ${targetDiscordId}.`, ephemeral: true });
          
          // Log the reset daily cooldown action in the log channel
          const logChannel = interaction.guild.channels.cache.get(logChannelId);
          if (logChannel) {
            logChannel.send(`${cooldownType} cooldown reset for user <@${targetDiscordId}>.`);
          } else {
            console.error("Log channel not found.");
          }
        });
      }
      else {
        db.query(`UPDATE users SET ${cooldownColumn} = 0 WHERE discord_id = ?`, [targetDiscordId], async (error) => {
          if (error) {
            console.error(error);
            await interaction.reply({ content: "An error occurred while resetting the cooldown.", ephemeral: true });
            return;
          }
          await interaction.reply({ content: `${cooldownType} cooldown reset for user with Discord ID ${targetDiscordId}.`, ephemeral: true });
          
          // Log the reset weekly or monthly cooldown action in the log channel
          const logChannel = interaction.guild.channels.cache.get(logChannelId);
          if (logChannel) {
            logChannel.send(`${cooldownType} cooldown reset for user with Discord ID ${targetDiscordId}.`);
          } else {
            console.error("Log channel not found.");
          }
        });
      }
    } else {
      await interaction.reply({ content: "Invalid cooldown type. Please provide 'daily', 'weekly', or 'monthly'.", ephemeral: true });
    }
  } catch (error) {
    console.error("Error resetting cooldown:", error);
    await interaction.reply({ content: "An error occurred while resetting the cooldown.", ephemeral: true });
  }
}

async function scheduleDailyReset(client, logChannelId) {
  // Calculate the time until the next midnight in GMT
  const millisecondsUntilMidnight = calculateMillisecondsUntilMidnight();
  // Schedule the reset function to run at the next midnight
  setTimeout(() => resetDailyClaims(client, logChannelId), millisecondsUntilMidnight);
}

function calculateMillisecondsUntilMidnight() {
  const currentTime = new Date();
  const currentHour = currentTime.getUTCHours();
  const currentMinute = currentTime.getUTCMinutes();
  const currentSecond = currentTime.getUTCSeconds();
  // Calculate milliseconds remaining until the next midnight in GMT
  return (24 - currentHour) * 60 * 60 * 1000 - currentMinute * 60 * 1000 - currentSecond * 1000;
}

async function resetDailyClaims(client, logChannelId) {
  try {
    // Reset daily_claim column for all users
    await new Promise((resolve, reject) => {
      db.query('UPDATE users SET daily_claim = 0', (error) => {
        if (error) {
          console.error("Error resetting daily claims:", error);
          reject(error);
        } else {
          console.log("Daily claims reset successfully.");
          resolve();
        }
      });
    });

    // Fetch the channel where you want to log the reset
    const channel = await client.channels.fetch(logChannelId);
    if (!channel) {
      console.error(`Error fetching channel ${logChannelId}.`);
      return;
    }

    // Send a log message in the channel
    channel.send("Daily claims have been reset.");

    // Schedule the next reset for the following day
    scheduleDailyReset();
  } catch (error) {
    console.error("Error in resetDailyClaims:", error);
    // Retry scheduling the reset if an error occurs
    scheduleDailyReset();
  }
}

function connectWithRetry() {
  db.connect(function (err) {
    if (err) {
      console.error('Error connecting to MySQL database:', err);
      console.log('Retrying connection in 10 seconds...');
      setTimeout(connectWithRetry, 10000);
    } else {
      console.log('Connected to MySQL database');
    }
  });
  
  db.on('error', function (err) {
    console.error('MySQL connection error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.log('Connection lost. Reconnecting...');
      connectWithRetry();
    } else {
      throw err;
    }
  });
}

client.login(bot_token);