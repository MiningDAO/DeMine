const { ethers, localConfig, run } = hre = require("hardhat");
const BigNumber = require('bignumber.js');
const config = require("../lib/config.js");
const logger = require("../lib/logger.js");
const common = require("../lib/common.js");
const time = require("../lib/time.js");

async function main() {
    const admin = await config.admin(hre);
    const coin = 'btc';
    await run('deploy', {tags: 'NFT'});
    const nft = await run('nft-clone', {coin: coin});
    const erc1155 = await ethers.getContractAt('ERC1155Facet', nft);
    const earningToken = await ethers.getContractAt(
        '@solidstate/contracts/token/ERC20/ERC20.sol:ERC20',
        await erc1155.earningToken()
    );

    if ((await earningToken.allowance(admin.address, nft)).eq(0)) {
        await run('nft-admin-setallowance', {
            coin: coin,
            nft: nft,
            allowance: '100.0'
        });
    }

    if ((await earningToken.balanceOf(admin.address)).eq(0)) {
        const earningTokenConfig = localConfig.earningToken[network.name] || {};
        // not pre-configured earning token, which means the
        // earning token is deployed by us
        if (!earningTokenConfig[coin.toLowerCase()]) {
            await run('wrapped-mint', {
                coin: 'btc',
                amount: '100.0',
                contract: earningToken.address
            });
        }
    }

    const custodian = await erc1155.custodian();
    const approved = await erc1155.isApprovedForAll(custodian, admin.address);
    if (!approved) {
        await run('nft-admin-custody', {
            coin: coin,
            nft: nft
        });
    }

    // mint
    const weekly = await run(
        'nft-tokens',
        {tokens: `2022-02-01,2023-02-01,weekly`}
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
                nft: nft,
                timestamp: i
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
