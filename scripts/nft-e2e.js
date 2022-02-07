const hre = require("hardhat");
const ethers = hre.ethers;

async function main() {
    const nft = await hre.run('nft-clone', {coin: 'btc'});
    const erc1155 = await ethers.getContractAt('ERC1155Facet', nft.target);
    const earningToken = await ethers.getContractAt(
        '@solidstate/contracts/token/ERC20/ERC20.sol:ERC20',
        await erc1155Facet.earningToken()
    );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });