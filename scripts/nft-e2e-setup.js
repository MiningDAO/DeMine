const { ethers, localConfig, run } = hre = require("hardhat");
const config = require("../lib/config.js");
const logger = require("../lib/logger.js");
const common = require("../lib/common.js");
const time = require("../lib/time.js");

async function setAllowance(earningToken, admin, nft) {
    const decimals = await earningToken.decimals();
    const allowance = ethers.BigNumber.from(10).pow(decimals).mul(100);
    logger.info('Setting allowance: ' + JSON.stringify({
        contract: earningToken.address,
        owner: admin.address,
        spender: nft,
        allowance: allowance.toString()
    }, null, 2));

    if (admin.signer) {
        await common.run(hre, async function() {
            return await earningToken.connect(
                admin.signer
            ).approve(nft, allowance);
        });
    } else {
        const calldata = earningToken.interface.encodeFunctionData(
            'approve', [nft, allowance]
        );
        logger.info('Not signer, calling info:' + JSON.stringify({
            operator: admin.address,
            contract: earningToken.address,
            calldata
        }, null, 2));
    }
}

async function mintEarningTokens(earningToken, admin) {
    var earningToken = await ethers.getContractAt(
        'ERC20Facet', earningToken.address
    );
    const decimals = await earningToken.decimals();
    const supply = ethers.BigNumber.from(10).pow(decimals).mul(1000);
    logger.info('Minting tokens: ' + JSON.stringify({
        operator: admin.address,
        address: earningToken.address,
        to: admin.address,
        supply: supply.toString()
    }, null, 2));

    if (admin.signer) {
        await common.run(hre, async function() {
            return await earningToken.connect(
                admin.signer
            ).mint(admin.address, supply);
        });
    } else {
        const calldata = earningToken.interface.encodeFunctionData(
            'mint',
            [admin.address, supply]
        );
        logger.info('Not signer, calling info: ' + JSON.stringify({
            operator: admin.address,
            contract: earningToken.address,
            calldata
        }, null, 2));
    }
}

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
        await setAllowance(earningToken, admin, nft);
    }

    if ((await earningToken.balanceOf(admin.address)).eq(0)) {
        const earningTokenConfig = localConfig.earningToken[network.name] || {};
        // not pre-configured earning token, which means the
        // earning token is deployed by us
        if (!earningTokenConfig[coin.toLowerCase()]) {
            await mintEarningTokens(earningToken, admin, nft);
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
