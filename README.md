# Basic Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, a sample script that deploys that contract, and an example of a task implementation, which simply lists the available accounts.

Try running some of the following tasks:

```shell
npx hardhat accounts
npx hardhat compile
npx hardhat clean
npx hardhat test
npx hardhat node
node scripts/sample-script.js
npx hardhat help
npx hardhat nft-xxx
npx hardhat wrapped-xxx
npx hardhat agent-xxx
```

# Operation Workflow

## Token Creation
Token issuer transform mining machine to hash power and mint tokens. TotalSupply = SupplyPerDay * Hashrate. Assuming 10 mining machines with 100T each and mining duration is 1000 days, we will get 1000 * 1000 = 1000000 tokens in total at this token pool. Each token represents (reward, cost) per T per day. Reward is decided by the coresponding mining day while cost is decided by mining farm the machines locates. Tokens at one pool share same cost.

## Lock and Liquidize
All released token are locked at DeMineAgent contract at default. There are two ways to liquidize these tokens.
- Token issuer can pay the cost and redeem these tokens. The cost is decided when minting these tokens.
- Token issuer can list these tokens for sale with a price and anyone can claim these tokens. Each listing can specify (buyer, price, amounts). Only buyer can claim these tokens listed. If buyer is not specified, anyone can claim these tokens.
Once tokens are liquidized, they are free to trade at market.

## 
We will send reward to nft contract and set the rewardPerToken for each token.

## Alchemize
User can burn their tokens and cashout reward tokens. However, user cannot cashout/burn unrewarded tokens.

## Billing
We need receive cost of tokens to pay billing of mining farm, including electricity bill and management fee. If all tokens are all liquidized, we will receive all cost of these tokens to cover the billing. If there are tokens not liquidized, we will cashout all these tokens and sell some reward tokens to cover the billing and send rest rewards to token issuer. If the reward cannot over billing, we will use the deposit and token issuer have to pay the billing.

# Contracts:

There are 10 contracts deployed:

 - Diamond: contract to provide diamond related functionalities
 - ERC20Facet: support multiple ERC20 token payments, in our case it's stable coin
 - MortgageFacet: contract to mortgage computation power to get tokens
 - PrimaryMarketFacet: contract to sell locked nfts
 - BillingFacet: contract to sell earnings to pay bills

All nft/agent/erc20 contracts are at contracts.json file. The part of the file is auto-generated so take care when editing it.
All BSC wrapped token are from: https://www.binance.org/en/assets-proof.

# Account System

- Deployer: to deploy contract
- Admin: owner of DeMineAgent and DeMineNFT contract
- Custodian: account holding assets of
    - income of pool owner
    - reserved cost for billing
    - cashed out reward for billing
    - recipient of royalty of token transfer
