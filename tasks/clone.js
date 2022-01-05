task('clone-token', 'Deploy clone of wrapped ERC20 token')
    .addOptionalParam('factory', 'clone factory contract address')
    .addParam('name', 'Wrapped token name')
    .addParam('symbol', 'Wrapped token symbol')
    .addParam('decimals', 'Wrapped token decimals')
    .setAction(async (args, { ehters, network }) => {
        const Factory = await ethers.getContractFactory('WrappedTokenCloneFactory');
        if (args.factory !== undefined) {
            const factory = await Factory.deploy();
            await factory.deployed();
            console.log('Wrapped token clone factory deployed at: ' + factory.address);
        } else {
            const factory = await Factory.attach(args.factory);
        }

        const { admin } = await ethers.getNamedSigners();
        const Token = await ethers.getContractFactory('WrappedToken');
        const tx = await factory.create(
            args.name, args.symbol, args.decimal, admin.address
        );
        const { events: events } = await tx.wait();
        const { args: [token] } = events.find(
          function(e) { return e.event === 'Clone'; }
        );
        console.log('Wrapped token contract is deployed at: ' + token);
    });

task('clone-demine', 'Deploy clone of demine nft and agent contract')
    .addOptionalParam('factory', 'Clone factory contract address')
    .setAction(async (args, { ethers, network, localConfig }) => {
        const { tokenUri, reward, payments } = localConfig[network.name];
        const Factory = await ethers.getContractFactory('DeMineCloneFactory');
        if (args.factory !== undefined) {
            const factory = await Factory.deploy();
            await factory.deployed();
        } else {
            const factory = await Factory.attach(arg.factory);
        }

        const { admin, custodian } = await ethers.getNamedSigners();
        const NFT = await ethers.getContractFactory('DeMineNFT');
        const Agent = await ethers.getContractFactory('DeMineAgent');
        const tx = await factory.create(
            tokenUri,
            custodian.address,
            100,
            reward,
            payments,
            custodian.address,
            admin.address
        );
        const { events: events } = await tx.wait();
        const { args: [nft, agent] } = events.find(
          function(e) { return e.event === 'Clone'; }
        );
        console.log('DeMineNFT contract is deployed at: ' + nft);
        console.log('DeMineAgent contract is deployed at: ' + agent);
    });
