const { ethers } = require("hardhat");

async function main() {
  const tokenUri = "https://token-cdn-domain/{id}.json";
  const wbtc = address(0x65058d7081fcdc3cd8727dbb7f8f9d52cefdd291);
  const usdt = address(0x6ee856ae55b6e1a249f04cd3b947141bc146273c);
  const royaltyRecipient = address(0xa4b368e3a9D49Ff15b58f70Fb976724A98B6D149);

  const DeMineNFT = await ethers.getContractFactory("DeMineNFT");
  const deMineNFT = await DeMineNFT.deploy(
      tokenUri,
      wbtcAddress,
      usdtAddress,
      royaltyRecipient,
      100
  );
  await deMineNFT.deployed();
  console.log("DeMineNFT deployed to:", deMineNFT.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
