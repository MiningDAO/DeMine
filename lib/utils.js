const { expect } = require("chai");
const p = require('prompts');

const memoize = (preix, timeout, func) => {
    const results = {};
    return async (...args) => {
        const argsKey = preix + '_' + JSON.stringify(args);
        const ts = new Date().getTime();
        if (!results[argsKey] || results[argsKey].expiredAt < ts) {
            results[argsKey] = {
                value: await func(...args),
                expiredAt: ts + timeout
            }
        }
        return results[argsKey].value;
    };
}

async function prompts(func) {
    return await (async () => {
        const response = await p({
          type: 'text',
          name: 'continue',
          message: 'Confirm to continue? (Y/n) '
        });
        var answer = response['continue'].toLowerCase();
        if (answer == 'y' || answer == 'yes') {
            return await func();
        }
    })();
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function setDeep(obj, path, value) {
    if (path.length == 1) {
        obj[path] = value
        return;
    }
    if (obj[path[0]] == undefined) {
        obj[path[0]] = {}
    }
    setDeep(obj[path[0]], path.slice(1), value);
}

function getDeep(obj, keys, defaultValue) {
    if (obj[keys[0]] === undefined) {
        return defaultValue;
    }
    if (keys.length == 1) {
        return obj[keys[0]];
    }
    return getDeep(obj[keys[0]], keys.slice(1), defaultValue);
}

async function compareArray(a, b) {
    expect(a.length).to.equal(b.length);
    for (let i = 0; i < a.length; i++) {
        expect(a[i]).to.equal(b[i]);
    }
}

module.exports = {
    prompts,
    setDeep,
    getDeep,
    memoize,
    sleep,
    compareArray,
}
