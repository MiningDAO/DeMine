const { ethers, run } = require("hardhat");

async function main() {
    await run('deploy', {tags: 'NFT'});
    const nft = await run('nft-clone', {coin: 'btc'});
    const erc1155 = await ethers.getContractAt('ERC1155Facet', nft);
    const earningToken = await ethers.getContractAt(
        '@solidstate/contracts/token/ERC20/ERC20.sol:ERC20',
        await erc1155.earningToken()
    );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });