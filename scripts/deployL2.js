const { ethers } = require("hardhat");

async function main() {
  const tokenUri = "https://token-cdn-domain/{id}.json";
  const wbtc = address(0x65058d7081fcdc3cd8727dbb7f8f9d52cefdd291);
  const usdt = address(0x6ee856ae55b6e1a249f04cd3b947141bc146273c);

  // deploy implementation
  const DeMineNFT = await ethers.getContractFactory("DeMineNFT");
  const deMineNFT = await DeMineNFT.deploy();
  await deMineNFT.deployed();

  // deploy clone factory
  const DeMineNFTCloneFactory = await ethers.getContractFactory("DeMineNFTCloneFactory");
  const deMineNFTCloneFactory = await DeMineNFTCloneFactory.deploy(deMineNFT.address);
  await deMineNFTCloneFactory.deployed();

  // deploy clones for btc
  const btcAddress = await deMineNFTCloneFactory.create(tokenUri, wbtc, usdt, 100);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
