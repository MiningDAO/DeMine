const { ethers, upgrades } = require("hardhat");

async function main() {
  const address founder = 0xa4b368e3a9D49Ff15b58f70Fb976724A98B6D149;
  const address investee = 0xEF2e3F91209F88A3143e36Be10D52502162426B3;

  const MiningDAO = await ethers.getContractFactory("MiningDAOMinerNFT");
  const miningDAONFT = await upgrade.deployProxy(MiningDAO, [founder, investee]);
  await miningDAONFT.deployed();

  console.log("MiningDAO deployed to:", miningDAONFT.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
