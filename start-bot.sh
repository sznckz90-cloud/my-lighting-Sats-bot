#!/bin/bash

# Start the LightingSats Telegram Bot
echo "🤖 Starting LightingSats Telegram Bot..."

# Set environment variables
export TELEGRAM_BOT_TOKEN="7561099955:AAF3Pc-C1-dhLiGqS_hwnegI5a9_55evHcQ"
export WEB_APP_URL="https://your-deployed-app.onrender.com"  # Update this with your Render URL

# Start the bot
node bot.js

echo "✅ Bot started successfully!"
echo "📱 Users can now message your bot at @lightingsats_bot"
echo "🔧 Update WEB_APP_URL in this file once you deploy to Render"