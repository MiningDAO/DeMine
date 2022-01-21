const { ethers, network, localConfig } = require('hardhat');

async function main() {
    const { address: adminFacet } = await deployments.get('DeMineAdminFacet');
    const { address: diamondFacet } = await deployments.get('DiamondFacet');
    const { address: erc1155Facet } = await deployments.get('ERC1155Facet');
    const { address: miningPoolFacet } = await deployments.get('MiningPoolFacet');
    const { address: demineNFT } = await deployments.get('DeMineNFT');
    await hre.run("clone-demine", {});
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
