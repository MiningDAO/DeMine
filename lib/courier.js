const { CourierClient } = require("@trycourier/courier");
const config = require('../config.js');
const logger = require('./logger');

const courier = CourierClient({
    authorizationToken: config.courier.auth_token
});

async function notifyGnosis(hre, coin, workflow, request, ops) {
    const { messageId } = await courier.send({
        brand: config.courier.brand,
        eventId: "9D4KR67K884D9GPVKHS51SFJCN8K",
        recipientId: "cc64baca-9ab6-4c06-930c-9b20ed0f22cc",
        profile: { email: config.courier.profile, },
        data: {
            network: hre.network.name,
            coin: coin,
            workflow: workflow,
            request: request,
            operations: ops,
        },
        override: {},
    });
    logger.info('Courier message id: ' + messageId);
    return messageId;
}

async function notifyE2EFailure(hre, coin, workflow, error) {
    const { messageId } = await courier.send({
        brand: config.courier.brand,
        eventId: "SH5W0XM9R94V4VKEHZJVE9VK683Q",
        recipientId: "6f76e74c-8dea-4ac1-bca6-d0661e9e8e53",
        profile: { email: config.courier.profile, },
        data: {
            network: hre.network.name,
            coin: coin,
            workflow,
            error
        },
        override: {},
    });
    logger.info('Courier message id: ' + messageId);
    return messageId;
}

module.exports = {
    notifyGnosis,
    notifyE2EFailure
}
