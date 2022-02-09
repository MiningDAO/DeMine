const { ethers, run } = hre = require("hardhat");
const BigNumber = require("bignumber.js");
const config = require("../lib/config.js");
const logger = require("../lib/logger.js");
const time = require("../lib/time.js");

async function main() {
    const admin = await config.admin(hre);
    if (admin.signer == undefined) {
        logger.info('Not signer, exiting');
        return;
    }

    const coin = 'btc';
    await run('deploy', {tags: 'NFT'});
    const nft = await run('nft-clone', {coin: coin});
    const erc1155 = await ethers.getContractAt('ERC1155Facet', nft);
    const earningToken = await ethers.getContractAt(
        '@solidstate/contracts/token/ERC20/ERC20.sol:ERC20',
        await erc1155.earningToken()
    );
    // set allowance
    const decimals = await earningToken.decimals();
    const allowance = ethers.BigNumber.from(10).pow(decimals).mul(100);
    if ((await earningToken.allowance(nft, admin.address)).eq(0)) {
        await earningToken.connect(admin.signer).approve(nft, allowance);
    }

    const custodian = await erc1155.custodian();
    const daily = await run(
        'nft-tokens',
        {tokens: "2022-02-02,2022-02-20,daily"}
    );
    if ((await erc1155.balanceOf(custodian, daily[0])).eq(0)) {
        await run(
            'nft-admin-mint',
            {
                coin: coin,
                nft: nft,
                ids: daily.map(i => i.toHexString()).join(','),
                amounts: Array(daily.length).fill(100000000).join(',')
            }
        );
    }
    const weekly = await run(
        'nft-tokens',
        {tokens: "2022-01-01,2023-01-01,weekly"}
    );
    if ((await erc1155.balanceOf(custodian, weekly[0])).eq(0)) {
        await run(
            'nft-admin-mint',
            {
                coin: coin,
                nft: nft,
                ids: weekly.map(i => i.toHexString()).join(','),
                amounts: Array(weekly.length).fill(100000000).join(',')
            }
        );
    }

    const recipient = "0x633Da015e60F63b7de56817e9680D532aAa20016";
    if ((await erc1155.balanceOf(recipient, daily[0])).eq(0)) {
        await run(
            'nft-admin-release',
            {
                coin: coin,
                nft: nft,
                ids: daily.map(i => i.toHexString()).join(','),
                amounts: Array(daily.length).fill(40).join(','),
                to: recipient
            }
        );
    }
    if ((await erc1155.balanceOf(recipient, weekly[0])).eq(0)) {
        await run(
            'nft-admin-release',
            {
                coin: coin,
                nft: nft,
                ids: weekly.map(i => i.toHexString()).join(','),
                amounts: Array(weekly.length).fill(60).join(','),
                to: recipient
            }
        );
    }

    const startTs = time.startOfDay(new Date('2022-02-02'));
    var finalized = (await erc1155.finalized()).toNumber();
    if (finalized == 0) {
        await run(
            'nft-admin-finalize',
            {
                coin: coin,
                nft: nft,
                timestamp: startTs
            }
        );
        finalized = startTs;
    }

    const endTs = time.startOfDay(new Date());
    for (let i = finalized + 86400; i <= endTs; i += 86400) {
        await run(
            'nft-admin-finalize',
            {
                coin: coin,
                nft: nft
            }
        );
    }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error(error);
    process.exit(1);
  });
