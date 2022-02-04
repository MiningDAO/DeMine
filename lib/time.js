function epoch() {
    return Math.floor(new Date().getTime() / 1000)
}

function toEpoch(date) {
    return Math.floor(date.getTime() / 1000)
}

function yesterday() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
}

function future(days) {
    const today = new Date();
    const future = new Date(today);
    future.setDate(future.getDate() + days);
    return future;
}

function startOfDay(date) {
    const timestamp = toEpoch(date);
    return timestamp - timestamp % 86400;
}

function validateDate(date) {
    return /^(\d{4}-\d{2}-\d{2})$/.test(date);
}

module.exports = {
    epoch,
    toEpoch,
    yesterday,
    future,
    startOfDay,
    validateDate,
}
