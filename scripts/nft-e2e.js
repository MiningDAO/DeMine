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
    await earningToken.connect(admin.signer).approve(nft, allowance);

    await run(
        'nft-admin-mint',
        {
            coin: coin,
            nft: nft,
            tokens: "2022-02-02,2022-02-20,daily",
            amount: 100000000
        }
    );
    await run(
        'nft-admin-mint',
        {
            coin: coin,
            nft: nft,
            tokens: "2022-01-01,2023-01-01,weekly",
            amount: 100000000
        }
    );

    await run(
        'nft-admin-release',
        {
            coin: coin,
            nft: nft,
            tokens: "2022-02-02,2022-02-20,daily",
            amount: 40,
            to: "0x633Da015e60F63b7de56817e9680D532aAa20016"
        }
    );
    await run(
        'nft-admin-release',
        {
            coin: coin,
            nft: nft,
            tokens: "2022-01-01,2023-01-01,weekly",
            amount: 60,
            to: "0x633Da015e60F63b7de56817e9680D532aAa20016"
        }
    );

    const startTs = time.toEpoch(new Date('2022-02-02'));
    await run(
        'nft-admin-finalize',
        {
            coin: coin,
            nft: nft,
            timestamp: startTs
        }
    );

    const endTs = time.startOfDay(new Date());
    for (let i = startTs + 86400; i <= endTs; i += 86400) {
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
