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
```

# Operation Workflow

## Token Creation
Token issuer transform mining machine to hash power and mint tokens. TotalSupply = SupplyPerDay * Hashrate. Assuming 10 mining machines with 100T each and mining duration is 1000 days, we will get 1000 * 1000 = 1000000 tokens in total at this token pool. Each token represents (reward, cost) per T per day. Reward is decided by the coresponding mining day while cost is decided by mining farm the machines locates. Tokens at one pool share same cost.

## Lock and Liquidize
All released token are locked at DeMineAgent contract at default. There are two ways to liquidize these tokens.
- Token issuer can pay the cost and redeem these tokens. The cost is decided when minting these tokens.
- Token issuer can list these tokens for sale with a price and anyone can claim these tokens. Each listing can specify (buyer, price, amounts). Only buyer can claim these tokens listed. If buyer is not specified, anyone can claim these tokens.
Once tokens are liquidized, they are free to trade at market.

## Reward Distribution
We will send reward to nft contract and set the rewardPerToken for each token.

## Cashout and burn
User can burn their tokens and cashout reward tokens. However, user cannot cashout/burn unrewarded tokens.

## Billing
We need receive cost of tokens to pay billing of mining farm, including electricity bill and management fee. If all tokens are all liquidized, we will receive all cost of these tokens to cover the billing. If there are tokens not liquidized, we will cashout all these tokens and sell some reward tokens to cover the billing and send rest rewards to token issuer. If the reward cannot over billing, we will use the deposit and token issuer have to pay the billing.

# Account System

- Admin: owner of DeMineAgent and DeMineNFT contract
- Rewarder: account holding all mined coins to reward DeMineNFT contract, could be same with owner
- Cost Recipient: recipient of cost paid by liqudizing tokens, could be same with owner
- Reward Recipient: recipient of cashed out reward to pay billing, could be same with owner
- DeMineNFT: the nft contract, holding nft tokens and reward tokens mined
- DeMineAgent: the agent contract, holding income from selling tokens for token issuer

# TestPlan

## DeMineNFT

Ownable:
- only owner can call some function

ERC2981:
- setRoyaltyInfo
- getRoyaltyInfo

ERC1155:
- Mint new token
- SetApprovedForAll
- isApprovedForAll
- balanceOf/balanceOfBatch

>> Test with both sender/operator:
- transfer/transferBatch

DeMineNFT Specific:
- reward
- rewardWithOverrides

>> Test with both sender/operator:
- cashout unrewarded cycle, should fail
- cashout rewarded cycle
  - tokens should be burned
  - recipient should receive reward tokens
  - reward token balance of nft contract should decrease
- cashout rewarded cycle with overrides
  - tokens should be burned
  - recipient should receive reward tokens
  - reward token balance of nft contract should decrease

- get agent address
- get reward token address


## DeMineAgent

NFT Pair && ERC1155 Reciever:
- pool set
- token locked

DeMineAgent View:
- nft address
- tokenStats
- income
- poolStats
- listing

DeMineAgent Actions:
- list
  - with sender as non token issuer, should fail
  - with token issuer as recipient, should fail
  - with cashedout token, should fail
  - with price lower than cost, should fail
  - with amount exceeding locked + listed, should fail
  - to address(0)
     - token stats should be updated
     - check listing result is set
  - to address(0) again
     - token stats should be updated
     - listing should be updated
  - to one recipient
     - token stats should be updated
     - check listing result is set
     - list event should be emitted
  - to one recipient again
     - token stats should be updated
     - listing should be updated
     - list event should be emitted

- unlist
  - with sender as non token issuer, should fail
  - with cashedout token, should fail
  - to address(0)
     - token stats should be updated
     - tokens should be unlisted
     - Unlist event should be emitted
  - to normal recipient
     - token stats should be updated
     - tokens should be unlisted
     - Unlist event should be emitted

- claim
  - with cashedout token, should fail
  - with amount exceeding listed, should fail
  - with not enough cost tokens to pay, should fail
  - with amount lower than listed for recipient
    - token stats should be updated
    - cost recipient should be paid
    - income of token issuer should increase
    - token should be transferred to claimer
  - with amount larger than listed for recipient but lower than total listed
    - token stats should be updated
      - listed for address(0)
    - cost recipient should be paid
    - cost token balance of agent contract should decrease
    - income of token issuer should increase
    - token should be transferred to claimer
    - Claim event should be emitted

- redeem
  - with non token issuer, should fail
  - with amount larger than total locked, should fail
  - with not enough tokens to pay, should fail
  - with correct ids and amounts
    - token stats should be updated
    - cost recipient should be paid
    - token should be transferred to token issuer
    - Redeem event should be emitted

- withdraw
  - with amount exceeding income, should fail
  - with correct amount
    - sender should be paid with cost token
    - cost token balance of agent contract should decrease
    - Withdraw event should be emitted

- cashout
  - with token already cashedout, should fail
  - with tokens with unrewarded cycle, should fail
  - with proper tokens to cashout
    - token stats should be updated
    - owner should receive reward tokens
    - tokens should be burned
