function key(...args) {
    return args.join('.');
}

const redis = require('redis').createClient();
redis.on('error', (err) => logger.info('Redis Client Error', err));
(async() => {
    await redis.connect();
    console.log('Redis reader ready');
})();

module.exports = {key, redis};
