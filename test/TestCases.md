# Test Cases

## DeMineNFT

ERC2981:
 - [x] setRoyaltyInfo from non-owner should fail
 - [x] setRoyaltyInfo, getRoyaltyInfo should updated

DeMineNFT Specific:
 - [x] create new pool from non owner, should fail
 - [x] create new pool with wrong supply array, should fail
 - [x] create new pool with start cycle too late, should fail
 - [x] create new pool from rewarded cycles, should fail
 - [x] create new pool
  - event TransferBatch from address(0) should be emitted
  - event NewPool should be emitted
  - DeMineAgent should with pool set
  - balanceOf issuer for ids should be same with supplies

 - [x] reward from non-owner should fail
 - [x] reward with insufficient allowance, should fail
 - [x] reward with insufficient balance, should fail
 - [x] reward with cycle with 0 supply
 - [x] reward with reward divisible by cycle supply
 - [x] reward with reward not divisible by cycle supply

 - [x] cashout unrewarded cycle, should fail
 - [x] cashout insufficient balance, should fail
 - [x] cashout insufficient allowance, should fail
 - [x] cashout with id and amounts array length mismatch, should fail
 - [x] cashout rewarded cycle with approved operator
  - tokens should be burned
  - recipient should receive reward tokens
  - reward token balance of nft contract should decrease
 - [x] cashout rewarded cycle with account owner
  - tokens should be burned
  - recipient should receive reward tokens
  - reward token balance of nft contract should decrease

ERC1155:
 - [x] check uri
 - [x] SetApprovedForAll
 - [x] isApprovedForAll
 - [x] transferBatch with insufficient balance, should fail
 - [x] transferBatch with nor approved, should fail
 - [x] transferBatch with owner
 - [x] transferBatch with approved user
 - [x] transfer with insufficient balance, should fail
 - [x] transfer with nor approved, should fail
 - [x] transfer with owner
 - [x] transfer with approved user

## DeMineAgent

Pool
 - [x] transferPool with non-owner, should fail
 - [x] transferPool with owner, should success

NFT Interaction
 - [x] [transfer]receive nft, from not minted tokens should fail
 - [x] [transfer batch]receive nft, from not minted tokens should fail
 - [x] [transfer]receive nft, from non-nft should fail
 - [x] [transfer batch]receive nft, from non-nft should fail
 - [x] [transfer]receive nft, token stats should be updated
 - [x] [transfer batch]receive nft, token stats should be updated

DeMineAgent State Update:
 - [x] set custodian, from non owner should fail
 - [x] set custodian, recipient should be updated
 - [x] set payment from non owner should fail
 - [x] set payment, payment info should be updated
  - check isPaymentSupported()

DeMineAgent Redeem Action
 - [ ] with non token issuer, should fail
 - [ ] with unsupported payment method, should fail
 - [ ] with amount larger than total locked, should fail
 - [ ] with not enough tokens to pay, should fail
 - [ ] with correct ids and amounts
    - token stats should be updated
    - cost recipient should be paid with proper payment method
    - nft token should be transferred from agent to token issuer
    - Redeem event should be emitted
    - tokenInfo covered

DeMineAgent List Action
 - [ ] with sender as non token issuer, should fail
 - [ ] with token issuer as recipient, should fail
 - [ ] with cashedout token, should fail
 - [ ] with price lower than cost, should fail
 - [ ] with amount exceeding locked + listed, should fail
 - [ ] to address(0)
     - token stats should be updated
     - check listing result is set
     - listingInfo covered
 - [ ] to address(0) again
     - token stats should be updated
     - listing should be updated
 - [ ] to one recipient
     - token stats should be updated
     - check listing result is set
     - list event should be emitted
 - [ ] to one recipient again
     - token stats should be updated
     - listing should be updated
     - list event should be emitted

DeMineAgent Unlist Action
 - [ ] with sender as non token issuer, should fail
 - [ ] with cashedout token, should fail
 - [ ] to address(0)
    - token stats should be updated
    - tokens should be unlisted
    - Unlist event should be emitted
 - [ ] to normal recipient
    - token stats should be updated
    - tokens should be unlisted
    - Unlist event should be emitted

DeMineAgent Claim Action
 - [ ] with cashedout token, should fail
 - [ ] with unsupported payment method, should fail
 - [ ] with amount exceeding listed, should fail
 - [ ] with not enough cost tokens to pay, should fail
 - [ ] with amount lower than listed for recipient
    - token stats should be updated
    - cost recipient should be paid
    - income of token issuer should increase
    - token should be transferred to claimer
 - [ ] with amount larger than listed for recipient but lower than total listed
    - token stats should be updated
      - check listingInfo for address(0)
    - cost token balance of payment recipient should increase
    - income info of token issuer should increase
    - cost token balance of agent should increase
    - nft tokens should be transferred from agent to claimer
    - Claim event should be emitted
    - tokenInfo covered

DeMineAgent Withdraw Action
 - [ ] with payments/amounts array mismatch, should fail
 - [ ] with amount exceeding income, should fail
 - [ ] with correct input
    - income info of sender should decrease
    - balance of sender should increase
    - balance of agent contract should decrease
    - Withdraw event should be emitted
    - incomeInfo covered

DeMineAgent Cashout Action
 - [ ] with token already cashedout, should fail
 - [ ] with tokens with unrewarded cycle, should fail
 - [ ] with proper tokens to cashout
    - token stats should be updated
    - owner should receive reward tokens
    - tokens should be burned
