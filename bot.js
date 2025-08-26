const TelegramBot = require('node-telegram-bot-api');

// Bot token from @BotFather
const token = process.env.TELEGRAM_BOT_TOKEN || '7561099955:AAF3Pc-C1-dhLiGqS_hwnegI5a9_55evHcQ';
const bot = new TelegramBot(token, {polling: true});

// Your web app URL (replace with your actual deployed URL)
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://your-app.replit.app';

// Admin ID for management
const ADMIN_ID = '6653616672';

// Bot commands and responses
bot.onText(/\/start(.*)/, (msg, match) => {
  const chatId = msg.chat.id;
  const referralCode = match[1] ? match[1].trim() : null;
  const firstName = msg.from.first_name || 'there';
  
  let welcomeMessage = `🌟 Welcome to LightingSats, ${firstName}!\n\n`;
  welcomeMessage += `💰 Earn real money by watching ads!\n`;
  welcomeMessage += `🎯 Each ad earns you $0.00035\n`;
  welcomeMessage += `📈 Watch up to 250 ads daily\n`;
  welcomeMessage += `👥 Refer friends and earn 10% commission\n\n`;
  
  if (referralCode) {
    welcomeMessage += `🎁 You were referred! You'll get bonus rewards.\n\n`;
  }
  
  welcomeMessage += `🚀 Tap "Launch App" to start earning!`;
  
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{
          text: '🚀 Launch Earning App',
          web_app: { url: referralCode ? `${WEB_APP_URL}?start=${referralCode}` : WEB_APP_URL }
        }],
        [{
          text: '📊 Check Stats',
          callback_data: 'stats'
        }, {
          text: '👥 Invite Friends',
          callback_data: 'invite'
        }],
        [{
          text: '❓ Help',
          callback_data: 'help'
        }]
      ]
    }
  };
  
  bot.sendMessage(chatId, welcomeMessage, keyboard);
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `❓ LightingSats Help\n\n` +
    `🎯 How it works:\n` +
    `• Watch ads to earn money\n` +
    `• Each ad = $0.00035\n` +
    `• Daily limit: 250 ads\n` +
    `• Minimum withdrawal: $1.00\n\n` +
    `📱 Commands:\n` +
    `/start - Launch the app\n` +
    `/help - Show this help\n` +
    `/stats - View your earnings\n\n` +
    `💬 Support: Contact admin if needed`;
    
  const keyboard = {
    reply_markup: {
      inline_keyboard: [[{
        text: '🚀 Launch App',
        web_app: { url: WEB_APP_URL }
      }]]
    }
  };
  
  bot.sendMessage(chatId, helpMessage, keyboard);
});

bot.onText(/\/stats/, (msg) => {
  const chatId = msg.chat.id;
  const statsMessage = `📊 Your LightingSats Stats\n\n` +
    `To view detailed statistics including:\n` +
    `• Current balance\n` +
    `• Ads watched today\n` +
    `• Total earnings\n` +
    `• Referral commissions\n\n` +
    `Please launch the app below:`;
    
  const keyboard = {
    reply_markup: {
      inline_keyboard: [[{
        text: '📊 View Full Stats',
        web_app: { url: WEB_APP_URL }
      }]]
    }
  };
  
  bot.sendMessage(chatId, statsMessage, keyboard);
});

// Handle callback queries from inline keyboard
bot.on('callback_query', (callbackQuery) => {
  const message = callbackQuery.message;
  const data = callbackQuery.data;
  const chatId = message.chat.id;
  
  switch(data) {
    case 'stats':
      const statsMessage = `📊 Launch the app to view your complete earnings dashboard with real-time balance updates!`;
      const statsKeyboard = {
        reply_markup: {
          inline_keyboard: [[{
            text: '📊 View Stats',
            web_app: { url: WEB_APP_URL }
          }]]
        }
      };
      bot.sendMessage(chatId, statsMessage, statsKeyboard);
      break;
      
    case 'invite':
      const userId = callbackQuery.from.id;
      const inviteMessage = `👥 Invite Friends & Earn More!\n\n` +
        `Share this link with friends:\n` +
        `https://t.me/lightingsats_bot?start=${userId}\n\n` +
        `💰 You earn 10% commission on all their earnings!\n` +
        `🎁 They get bonus rewards too!\n\n` +
        `Or use the share button in the app for easier sharing.`;
        
      const inviteKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [{
              text: '🚀 Launch App',
              web_app: { url: WEB_APP_URL }
            }],
            [{
              text: '📤 Share Link',
              switch_inline_query: `Join me on LightingSats and earn money watching ads! https://t.me/lightingsats_bot?start=${userId}`
            }]
          ]
        }
      };
      bot.sendMessage(chatId, inviteMessage, inviteKeyboard);
      break;
      
    case 'help':
      bot.sendMessage(chatId, 'Use /help command for detailed information.');
      break;
  }
  
  // Answer callback query to remove loading state
  bot.answerCallbackQuery(callbackQuery.id);
});

// Handle any other messages
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Ignore command messages (they're handled above)
  if (text && !text.startsWith('/')) {
    const helpMessage = `Hi! 👋\n\n` +
      `I'm the LightingSats bot. Use these commands:\n` +
      `/start - Launch the earning app\n` +
      `/help - Get help\n` +
      `/stats - View your stats\n\n` +
      `Or tap the button below to start earning:`;
      
    const keyboard = {
      reply_markup: {
        inline_keyboard: [[{
          text: '🚀 Start Earning',
          web_app: { url: WEB_APP_URL }
        }]]
      }
    };
    
    bot.sendMessage(chatId, helpMessage, keyboard);
  }
});

console.log('LightingSats bot is running...');
console.log('Web App URL:', WEB_APP_URL);

// Export bot for use in other files if needed
module.exports = bot;