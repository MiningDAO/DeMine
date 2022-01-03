const { ethers } = require("hardhat");

async function main() {
  const tokenUri = "invalid_uri";
  const wbtc = address(0x65058d7081fcdc3cd8727dbb7f8f9d52cefdd291);
  const usdt = address(0x6ee856ae55b6e1a249f04cd3b947141bc146273c);

  // deploy implementation
  const DeMineFactory = await ethers.getContractFactory("DeMineCloneFactory");
  const deMineFactory = await DeMineFactory.deploy();
  await deMineFactory.deployed();

  const NFT = await ethers.getContractFactory("DeMineNFT");
  const Agent = await ethers.getContractFactory("DeMineAgent");

  // deploy clone factory
  const tx = await deMineFactory.create(
    // nft
    tokenUri,
    royaltyRecipient,
    royaltyBps,
    rewardToken,
    // admin
    payments,
    custodian,
    // owner
    owner
  );

  const { events: events } = await tx.wait();
  const { args: [nftAddr, agentAddr] } = events.find(
    function(e) { return e.event === 'NewContract'; }
  );
  const nft = await NFT.attach(nftAddr);
  const agent = await Agent.attach(agentAddr);

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
