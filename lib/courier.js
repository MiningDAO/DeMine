const { CourierClient } = require("@trycourier/courier");
const config = require('../config.js');
const logger = require('./logger');

const courier = CourierClient({
    authorizationToken: config.courier.auth_token
});

async function notifyGnosis(hre, coin, workflow, request, ops) {
    const config = hre.localConfig.courier;
    const { messageId } = await courier.send({
        brand: config.brand,
        eventId: "9D4KR67K884D9GPVKHS51SFJCN8K",
        recipientId: config.gnosis_recipient_id,
        profile: { email: config.profile, },
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
    const config = hre.localConfig.courier;
    const { messageId } = await courier.send({
        brand: config.brand,
        eventId: "SH5W0XM9R94V4VKEHZJVE9VK683Q",
        recipientId: config.e2e_recipient_id,
        profile: { email: config.profile, },
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
