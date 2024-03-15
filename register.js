const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const mysql = require('mysql');
const fs = require('fs');
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

function loadConfigFromFile(filePath) {
    const rawConfig = fs.readFileSync(filePath);
    return JSON.parse(rawConfig);
}
const configFilePaths = ['config/discord_config.json', 'config/mysql_config.json'];
const config = configFilePaths.reduce((mergedConfig, filePath) => {
    const fileConfig = loadConfigFromFile(filePath);
    return { ...mergedConfig, ...fileConfig };
}, {});

const bot_token = config.bot_token;
const guildId = config.guildId;
const host = config.databaseHost;
const user = config.databaseUser;
const password = config.databasePassword;
const database = config.databaseName;

const connection = mysql.createConnection({
    host: host,
    user: user,
    password: password,
    database: database
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to MySQL database');

    // SQL query to create the users table
    const createUserTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        discord_id VARCHAR(255) UNIQUE,
        minecraft_username VARCHAR(255),
        last_change BIGINT(20),
        daily_claim TINYINT(1) DEFAULT 0,
        last_weekly_claim BIGINT(20) DEFAULT 0,
        last_monthly_claim BIGINT(20) DEFAULT 0
      )
    `;

    // Execute the query to create the users table
    connection.query(createUserTableQuery, (error, results, fields) => {
        if (error) {
            console.error('Error creating users table:', error);
        } else {
            console.log('Users table created successfully');
        }

        // Close the connection
        connection.end();
    });
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    const commands = [
        {
            name: 'setusername',
            description: 'Set your Minecraft username',
            options: [
                {
                    name: 'username',
                    type: 3,
                    description: 'Your Minecraft username',
                    required: true,
                },
            ],
        },
        {
            name: 'changeusername',
            description: 'Change your Minecraft username',
            options: [
                {
                    name: 'username',
                    type: 3,
                    description: 'Your new Minecraft username',
                    required: true,
                },
            ],
        },
        {
            name: 'getusername',
            description: 'Get your current Minecraft username',
        },
        {
            name: 'claimdaily',
            description: 'Claim your daily reward',
        },
        {
            name: 'claimweekly',
            description: 'Claim your weekly reward',
        },
        {
            name: 'claimmonthly',
            description: 'Claim your monthly reward',
        },
        {
            name: 'list',
            description: 'List all Discord IDs and usernames in the database',
            defaultPermission: false, // Set default permission to false
        },
        {
            name: 'deldata',
            description: 'Remove user data from the database',
            defaultPermission: false, // Set default permission to false
            options: [
                {
                    name: 'discord_id',
                    type: 3, // String
                    description: 'Discord ID(s) to delete from the database',
                    required: true,
                },
            ],
        },
        {
            name: 'resetdatabase',
            description: 'Clear the entire database',
            defaultPermission: false, // Set default permission to false
        },
        {
            name: 'resetcooldown',
            description: 'Reset the cooldown for a specific user',
            defaultPermission: false, // Set default permission to false
            options: [
                {
                    name: 'discord_id',
                    description: 'The Discord ID of the user whose cooldown will be reset',
                    type: 3,
                    required: true
                },
                {
                    name: 'cooldown_type',
                    description: 'The type of cooldown to reset (daily, weekly, monthly)',
                    type: 3,
                    required: true,
                    choices: [
                        {
                            name: 'Daily',
                            value: 'daily'
                        },
                        {
                            name: 'Weekly',
                            value: 'weekly'
                        },
                        {
                            name: 'Monthly',
                            value: 'monthly'
                        }
                    ]
                }
            ]
        }
    ];
    try {
        const rest = new REST({ version: '9' }).setToken(bot_token); // Initialize rest
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, guildId), // Replace with your actual guild ID
            { body: commands },
        );
        console.log('Successfully registered application (/) commands.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

client.login(bot_token);

setTimeout(() => {
    console.log('Exiting...');
}, 10000);

setTimeout(() => {
    process.exit();
}, 12000);