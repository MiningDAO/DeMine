const { verify } = hre = require("hardhat");
const config = require("../lib/config.js");
const logger = require("../lib/logger.js");

async function main() {
    const diamond = await config.getDeployment(hre, 'Diamond');
    logger.info('Verifying Diamond');
    await run(
        'verify',
        {
            address: diamond.address,
            constructorArgsParams: []
        }
    );

    const erc20Facet = await config.getDeployment(hre, 'ERC20Facet');
    logger.info('Verifying ERC20Facet');
    await run(
        'verify',
        {
            address: erc20Facet.address,
            constructorArgsParams: []
        }
    );

    const admin = await config.admin(hre);
    const custodian = await config.getDeployment(hre, 'ERC1155Custodian');
    logger.info('Verifying ERC1155Custodian');
    await run(
        'verify',
        {
            address: custodian.address,
            constructorArgsParams: [admin.address]
        }
    );

    const erc1155Facet = await config.getDeployment(hre, 'ERC1155Facet');
    logger.info('Verifying ERC1155Facet');
    await run(
        'verify',
        {
            address: erc1155Facet.address,
            constructorArgsParams: [custodian.address]
        }
    );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error(error);
    process.exit(1);
  });
