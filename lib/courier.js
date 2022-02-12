const { CourierClient } = require("@trycourier/courier");
const config = require('../config.js');
const logger = require('./logger');

const courier = CourierClient({
    authorizationToken: config.courier.auth_token
});

const toString = (obj, sep) => {
    const entries = Object.entries(obj).map(
        ([key, value]) => key + sep + value
    );
    return entries.join('\n\n');
};

async function notifyGnosis(hre, coin, request, rawRequest, note) {
    const { messageId } = await courier.send({
        brand: config.courier.brand,
        eventId: "9D4KR67K884D9GPVKHS51SFJCN8K",
        recipientId: "cc64baca-9ab6-4c06-930c-9b20ed0f22cc",
        profile: { email: config.courier.profile, },
        data: {
            network: hre.network.name,
            coin: coin,
            request: toString({
                senderAddress: request.senderAddress,
                safeAddress: request.safeAddress,
                to: request.safeTransaction.data.to,
                calldata: request.safeTransaction.data.data,
            }, ': '),
            rawRequest: toString(rawRequest, ': '),
            note: toString(note, ' is ')
        },
        override: {},
    });
    logger.info('Courier message id: ' + messageId);
    return messageId;
}

async function notifyFailure(hre, coin, msg, data) {
    const { messageId } = await courier.send({
        brand: config.courier.brand,
        eventId: "SH5W0XM9R94V4VKEHZJVE9VK683Q",
        recipientId: "6f76e74c-8dea-4ac1-bca6-d0661e9e8e53",
        profile: { email: config.courier.profile, },
        data: {
            network: hre.network.name,
            coin: coin,
            msg: msg,
            stacktrace: data
        },
        override: {},
    });
    logger.info('Courier message id: ' + messageId);
    return messageId;
}

module.exports = {
    notifyGnosis,
    notifyFailure
}
