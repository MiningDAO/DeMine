const { expect } = require("chai");
const { ethers } = hre = require("hardhat");
const config = require("../lib/config.js");
const time = require("../lib/time.js");

const { logger } = require('../lib/logger.js');
const transport = logger.transports.find(
    t => t.name == 'console'
);
transport.level = 'warn';

describe("Mining3", function () {
    const coin = 'btc';
    var mining3, earningToken;
    var admin, test;

    beforeEach(async function() {
        const signers = await ethers.getNamedSigners();
        test = signers.test;
        admin = await config.admin(hre);
        await hre.deployments.fixture(['Local', 'Mining3']);
        mining3 = await hre.run('mining3-clone', {coin: coin});
        mining3 = await ethers.getContractAt('Mining3', mining3);
        beacon = await config.getDeployment(hre, 'UpgradeableBeacon');

        earningToken = ethers.getContractAt(
            '@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20',
            await mining3.earningToken()
        );
    });

    it("proxy check", async function() {
        const mining3Proxy = await ethers.getContractAt('Mining3Proxy', mining3.address);
        expect(await mining3Proxy.beacon()).to.equal(beacon.address);

        const ibeacon = await ethers.getContractAt('IBeacon', beacon.address);
        const mining3Deployment = await config.getDeployment(hre, 'Mining3');
        expect(await ibeacon.implementation()).to.equal(mining3Deployment.address);
    });

    it("mining3 metadata", async function() {
        const DEFAULT_SNAPSHOT = time.startOfDay(new Date());
        expect(await mining3.lastFinalizedAt()).to.equal(DEFAULT_SNAPSHOT);

        expect(await mining3.name()).to.equal('Mining3 token for BTC');
        expect(await mining3.symbol()).to.equal('m3BTC');
        expect(await mining3.decimals()).to.equal(18);

        expect(await mining3.owner()).to.equal(admin.address);
        await expect(
            mining3.connect(test).transferOwnership(test.address)
        ).to.be.revertedWith('Ownable: caller is not the owner');
        await mining3.connect(admin.signer).transferOwnership(test.address);
        expect(await mining3.owner()).to.equal(test.address);
    });

    it("mining3 erc20", async function() {
        await expect(
            mining3.connect(test).mint(test.address, 10000)
        ).to.be.revertedWith('Ownable: caller is not the owner');

        await expect(
            mining3.connect(test).burn(10000)
        ).to.be.revertedWith('Ownable: caller is not the owner');

        expect(await mining3.balanceOf(test.address)).to.equal(0);
        await mining3.connect(admin.signer).mint(test.address, 10000);
        expect(await mining3.balanceOf(test.address)).to.equal(10000);

        // transfer
        await mining3.connect(test).transfer(admin.address, 5000);
        expect(await mining3.balanceOf(test.address)).to.equal(5000);
        expect(await mining3.balanceOf(admin.address)).to.equal(5000);

        // transfer from
        await expect(
            mining3.connect(admin.signer).transferFrom(test.address, admin.address, 5000)
        ).to.be.revertedWith('');

        await mining3.connect(test).approve(admin.address, 5000);
        expect(await mining3.allowance(test.address, admin.address)).to.equal(5000);
        await mining3.connect(admin.signer).transferFrom(test.address, admin.address, 5000)
        expect(await mining3.allowance(test.address, admin.address)).to.equal(0);
        expect(await mining3.balanceOf(test.address)).to.equal(0);
        expect(await mining3.balanceOf(admin.address)).to.equal(10000);

        await mining3.connect(admin.signer).burn(5000);
        expect(await mining3.balanceOf(admin.address)).to.equal(5000);
    });

    it("mining3 snapshot", async function() {
        const date = new Date();
        const timestamp = time.toEpoch(date);
        const mine = async function(n) {
            await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 86400 * n]);
            await network.provider.send("evm_mine");
        };
        await mining3.connect(admin.signer).mint(admin.address, 10000);
        for (let i = 0; i < 50; i++) {
            await mine(i + 1);
            await mining3.connect(admin.signer).transfer(test.address, 100);
            await mining3.connect(admin.signer).burn(100);
        }

        const startSnapshot = time.startOfDay(date);
        for (let i = 0; i < 50; i++) {
            const snapshot = startSnapshot + 86400 * (i + 1);
            expect(await mining3.totalSupplyAt(snapshot)).to.equal(10000 - 100 * i);
            expect(
                await mining3.balanceOfAt(admin.address, snapshot)
            ).to.equal(10000 - 200 * i);
            expect(
                await mining3.balanceOfAt(test.address, snapshot)
            ).to.equal(100 * i);
        }
    });
});

