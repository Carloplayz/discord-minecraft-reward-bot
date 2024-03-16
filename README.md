# Discord Reward Bot

Discord Reward Bot, developed by carlo_playz, is designed to manage daily, weekly, or monthly rewards for players on a Discord server. It utilizes RCON to send commands and MySQL to store data efficiently.

## How to Use

1. **Download the Repository:** Obtain the entire repository containing the Discord Reward Bot.
   
2. **Configure Bot Settings:** Navigate to the `config` folder and configure the necessary settings for your bot.

3. **Install Dependencies:** Run `install.cmd` to install all the required dependencies.

4. **Register the Bot:** Execute `register.cmd` to register the bot.

5. **Run the Bot:** Launch the bot by running `run.cmd`.

## Notes

- CMD files are specifically designed for Windows environments.
- For Linux users, manual execution of commands is necessary.
- Ensure that the MySQL and RCON configurations are set up correctly on your server.

## Features / Commands

1. **Set Username:**

    *Description:* Set your Minecraft username.
    
    *Usage:* `/setusername [username]`
    
    *Parameters:*
    
        `username`: Your Minecraft username.
        
    *Example:* `/setusername Steve`
    
2. **Change Username:**

    *Description:* Change your Minecraft username.
    
    *Usage:* `/changeusername [username]`
    
    *Parameters:*
    
        `username`: Your new Minecraft username.
        
    *Example:* `/changeusername Alex`
    
3. **Get Username:**

    *Description:* Get your current Minecraft username.
    
    *Usage:* `/getusername`
    
    *Example:* `/getusername`
    
4. **Claim Daily:**

    *Description:* Claim your daily reward.
    
    *Usage:* `/claimdaily`
    
    *Example:* `/claimdaily`
    
5. **Claim Weekly:**

    *Description:* Claim your weekly reward.
    
    *Usage:* `/claimweekly`
    
    *Example:* `/claimweekly`
    
6. **Claim Monthly:**

    *Description:* Claim your monthly reward.
    
    *Usage:* `/claimmonthly`
    
    *Example:* `/claimmonthly`
    
7. **List:**

    *Description:* List all Discord IDs and usernames in the database.
    
    *Usage:* `/list`
    
    *Example:* `/list`
    
    *Note:* Default permission is set to false.
    
8. **Delete Data:**

    *Description:* Remove user data from the database.
    
    *Usage:* `/deldata [discord_id]`
    
    *Parameters:*
        `discord_id`: Discord ID(s) to delete from the database.
        
    *Example:* `/deldata 1234567890`
    
    *Note:* Default permission is set to false.
    
9. **Reset Database:**

    *Description:* Clear the entire database.
    
    *Usage:* `/resetdatabase`
    
    *Example:* `/resetdatabase`
    
    *Note:* Default permission is set to false.
    
10. **Reset Cooldown:**

    *Description:* Reset the cooldown for a specific user.
    
    *Usage:* `/resetcooldown [discord_id] [cooldown_type]`
    
    *Parameters:*
        `discord_id`: The Discord ID of the user whose cooldown will be reset.
        `cooldown_type`: The type of cooldown to reset (daily, weekly, monthly).
        
    *Example:* `/resetcooldown 1234567890 daily`
    
    *Note:* Default permission is set to false.
    