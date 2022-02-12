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
        eventId: config.courier.event_id.gnosis,
        recipientId: config.courier.recipient_id,
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

module.exports = {
    notifyGnosis
}
