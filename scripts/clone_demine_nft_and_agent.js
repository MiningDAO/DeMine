const { ethers, network, localConfig } = require('hardhat');

async function main() {
    const { address: diamondFacet } = await deployments.get('DiamondFacet');
    const { address: erc2981Facet } = await deployments.get('ERC2981Facet');
    const { address: erc1155MetadataFacet } = await deployments.get('ERC1155MetadataFacet');
    const { address: demineNFTFacet } = await deployments.get('DeMineNFTFacet');
    const { address: demineNFT } = await deployments.get('DeMineNFT');
    await hre.run("clone-demine", {});
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
