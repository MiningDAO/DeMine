# Test Cases

## DeMineNFT

Pausable
 - [x] pause with non owner, should fail
 - [x] pause with owner, paused should be updated
 - [x] transfer when pause, should fail
 - [x] transfer batch when pause, should fail
 - [x] new pool when pause, should fail
 - [x] cashout when pause, should fail
 - [x] unpause with non owner, should fail
 - [x] unpause with owner, paused should be updated
 - [x] new pool after unpause, should success
 - [x] transfer after unause, should success
 - [x] transfer batch after unause, should success
 - [x] cashout after unause, should success

ERC2981:
 - [x] setRoyaltyInfo from non-owner should fail
 - [x] setRoyaltyInfo, getRoyaltyInfo should updated

DeMineNFT Create Pool
 - [x] create new pool from non owner, should fail
 - [x] create new pool with wrong supply array, should fail
 - [x] create new pool from invalid start cycles, should fail
 - [x] create new pool with pool owner as 0, should fail
 - [x] create new pool with base price lower than cost, should fail
 - [x] create new pool
    - event TransferBatch from address(0) should be emitted
    - DeMineAgent should with pool set and token stats updated
    - balance of agent should increase

DeMineNFT Expand Pool
 - [x] expand pool from non owner, should fail
 - [x] expand pool with wrong supply array, should fail
 - [x] expand pool with start cycle too late, should fail
 - [x] expand pool with non-exist pool, should fail
 - [x] expand new pool
    - event TransferBatch from address(0) should be emitted
    - DeMineAgent should with pool set and token stats updated
    - balance of agent should increase

DeMineNFT RewardNext
 - [x] reward from non-owner should fail
 - [x] reward with insufficient allowance, should fail
 - [x] reward with insufficient balance, should fail
 - [x] reward with cycle with 0 supply
 - [x] reward with reward divisible by cycle supply
 - [x] reward with reward not divisible by cycle supply

DeMineNFT RewardCurrent
 - [x] reward from non-owner should fail
 - [x] reward with insufficient allowance, should fail
 - [x] reward with insufficient balance, should fail
 - [x] reward with cycle with 0 supply
 - [x] reward with reward divisible by cycle supply
 - [x] reward with reward not divisible by cycle supply

DeMineNFT Cashout
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

Pausable
 - [x] pause with non owner, should fail
 - [x] pause with owner, paused should be updated
 - [x] transfer pool when pause, should fail
 - [x] redeem when pause, should fail
 - [x] increase/decrease allowance when pause, should fail
 - [x] unlist when pause, should fail
 - [x] claim/claimUnamed when pause, should fail
 - [x] setPrices when pause, should fail
 - [x] unpause with non owner, should fail
 - [x] unpause with owner, paused should be updated
 - [x] transfer pool after unpause, should success
 - [x] setPrices after unpause, should success
 - [x] increase/decrease allowance after pause, should success
 - [x] redeem after unpause, should success
 - [x] claim/claimUnamed after unpause, should success

Pool
 - [x] setPrice with array mismatch, should fail
 - [x] setPrice with non-owner, should fail
 - [x] setPrice with price lower than cost, should fail
 - [x] setPrice with pool owner, should success
    - use prices(ids) to confirm price info, tokens with without price set should use base price
 - [x] transferPool with non-owner, should fail
 - [x] transferPool to address(0), should fail
 - [x] transferPool with pool owner, should success

NFT Interaction
 - [x] [transfer]receive nft, from not minted tokens should fail
 - [x] [transfer batch]receive nft, from not minted tokens should fail
 - [x] [transfer]receive nft, from non-nft should fail
 - [x] [transfer batch]receive nft, from non-nft should fail
 - [x] [transfer]receive nft with new pool, token and pool stats should be updated
 - [x] [transfer batch]receive nft with new pool, token and pool stats should be updated
 - [ ] [transfer]receive nft with expanding pool, only token stats should be updated
 - [ ] [transfer batch]receive nft with expanding pool, only token stats should be updated

DeMineAgent State Update:
 - [x] set custodian, from non owner should fail
 - [x] set custodian, recipient should be updated
 - [x] set payment from non owner should fail
 - [x] set payment, payment info should be updated
    - check isPaymentSupported()

DeMineAgent Redeem Action
 - [x] with array length not match, should fail
 - [x] with non pool owner, should fail
 - [x] with insufficient supply, should fail
 - [x] with unsupported payment method, should fail
 - [x] with payment failed, should fail
 - [x] with correct ids and amounts
    - token stats should be updated(tokenInfo covered)
    - custodian should be paid with proper payment method
    - nft token should be transferred from agent to token issuer
    - Redeem event should be emitted

DeMineAgent Allowance Update Action
 - [x] increase with non pool owner, should fail
 - [x] increase with array mismatch, should fail
 - [x] increase allowance for address0, should success
 - [x] increase allowance for address0 again, should success
 - [x] increase allowance for normal user, should success
 - [x] increase allowance for normal user again, should success
 - [x] decrease with non pool owner, should fail
 - [x] decrease with array mismatch, should fail
 - [x] decrease with allowance below 0, should fail
 - [x] decrease allowance for address0, should success
 - [x] decrease allowance for address0 again to 0, should success
 - [x] decrease allowance for normal user, should success
 - [x] decrease allowance for normal user again to 0, should success

DeMineAgent Claim Action
 - [x] with unsupported payment method, should fail
 - [x] with array length mismatch, should fail
 - [x] with amount exceeding allowance, should fail
 - [x] with amount exceeding supply, should fail
 - [x] with payment failed, should fail
 - [x] claimUnnamed, success
 - [x] claim, success
    - allowance should be updated
    - custodian should be paid with proper price
    - token should be transferred to claimer

DeMineAgent Cashout Action
 - [x] with non owner, should fail
 - [x] with token already burned, should fail
 - [x] with unrewarded cycle, should fail
 - [x] with tokens exceeding supply, should fail
 - [x] with proper tokens to cashout
    - token stats should be updated
    - owner should receive reward tokens
    - tokens should be burned
