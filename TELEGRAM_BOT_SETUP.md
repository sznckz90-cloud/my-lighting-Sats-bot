# LightingSats Telegram Bot Setup Guide

Your app now has **both** a web interface AND a traditional Telegram bot that responds to commands!

## 🤖 What the Bot Does

When users interact with your bot, they get:

### `/start` Command Response:
```
🌟 Welcome to LightingSats, [Name]!

💰 Earn real money by watching ads!
🎯 Each ad earns you $0.00035
📈 Watch up to 250 ads daily
👥 Refer friends and earn 10% commission

🚀 Tap "Launch App" to start earning!
```

**With Buttons:**
- 🚀 Launch Earning App (opens your web app)
- 📊 Check Stats
- 👥 Invite Friends
- ❓ Help

### Other Commands:
- `/help` - Shows how the app works
- `/stats` - Prompts to launch app for stats
- Any other message - Helpful guidance with app launch button

## 🔧 Setup Steps

### 1. Create Your Telegram Bot
1. Message @BotFather on Telegram
2. Send `/newbot`
3. Choose a name: "LightingSats"
4. Choose username: "lightingsats_bot" (or whatever you prefer)
5. Save the **bot token** you receive

### 2. Configure Web App
1. Send `/mybots` to @BotFather
2. Select your bot
3. Go to "Bot Settings" → "Menu Button"
4. Set Menu Button URL to your deployed app URL
5. Set button text to "🚀 Launch App"

### 3. ✅ CONFIGURED - Your Bot Details
**Bot Token:** `7561099955:AAF3Pc-C1-dhLiGqS_hwnegI5a9_55evHcQ`
**Admin ID:** `6653616672` 
**Bot Username:** `@lightingsats_bot` (update this if different)

### 4. Set Environment Variables
Add these to your Render deployment:
```
TELEGRAM_BOT_TOKEN=7561099955:AAF3Pc-C1-dhLiGqS_hwnegI5a9_55evHcQ
WEB_APP_URL=https://lighting-sats-u7wg.onrender.com
```

### 5. Run the Bot
**Development:**
```bash
npm run bot
```

**Production:** 
The bot runs separately from your web app. You can:
- Deploy it on another Render service
- Run it on the same server as a background process
- Use a serverless platform like Vercel Functions

## 🎯 User Experience Flow

1. **User sends `/start`** → Gets welcome message with launch button
2. **User clicks "Launch App"** → Opens your React web app inside Telegram  
3. **User watches ads** → Earns money through your web interface
4. **User can return to bot** → Always has easy access to launch the app

## 🔗 Referral System

The bot automatically handles referral links:
- `/start ABC123` → User gets referred by ABC123
- Generates personal referral links: `https://t.me/your_bot?start=USER_ID`
- 10% commission tracking built-in

## ✅ Why This is Better

**Traditional bot users get:**
- Familiar command interface (`/start`, `/help`)
- Clear introduction and instructions
- Easy button to launch your app

**Modern users get:**
- Full web app experience
- Real-time earnings tracking
- Professional interface

**You get:**
- Higher user engagement (both types covered)
- Better user onboarding
- Professional bot presence
- Viral referral sharing

Your bot now works like popular services (like @wallet or @gamebot) that combine chat commands with web apps!