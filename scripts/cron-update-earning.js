var cron = require('node-cron');

cron.schedule('* * 8 * *', () => {
  console.log('running 8am every day');
});
