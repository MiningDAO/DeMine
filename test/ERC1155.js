module.exports = class ERC1155 {
    constructor() {
        this.balance = {};
        this.approve = {};
    }

    balanceOf(user, id) {
        if (this.balance[id] === undefined) {
            this.balance[id] = {};
        }
        if (this.balance[id][user] === undefined) {
            this.balance[id][user] = 0
        }
        return this.balance[id][user];
    }

    balanceOfBatch(users, ids) {
        var balances = [];
        for (var i = 0; i < ids.length; i++) {
            balances.push(this.balanceOf(users[i], ids[i]));
        }
        return balances;
    }

    isApprovedForAll(owner, operator) {
        if (this.approve[owner] === undefined) {
            this.balance[owner] = {};
        }
        if (this.balance[owner][operator] === undefined) {
            this.balance[owner][operator] = false;
        }
        return this.balance[owner][operator];
    }

    setApproveForAll(owner, operator, approved) {
        if (this.approve[owner] === undefined) {
            this.balance[owner] = {};
        }
        this.approve[owner][operator] = approved;
    }

    mint(to, id, amount) {
        var toBalance = this.balanceOf(to, id);
        this.balance[id][to] = toBalance + amount;
    }

    mintBatch(to, ids, amounts) {
        for (var i = 0; i < ids.length; i++) {
            this.mint(to, ids[i], amounts[i]);
        }
    }

    transfer(from, to, id, amount) {
        var fromBalance = this.balanceOf(from, id);
        var toBalance = this.balanceOf(to, id);
        this.balance[id][from] = fromBalance - amount;
        this.balance[id][to] = toBalance + amount;
    }

    transferBatch(from, to, ids, amounts) {
        for (var i = 0; i < ids.length; i++) {
            this.transfer(from, to, ids[i], amounts[i]);
        }
    }
}
