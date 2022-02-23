// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import '../../nft/interfaces/IERC1155Rewardable.sol';

struct BillingStatement {
    uint balance;  // Today's total locked (not liquidated) NFT for today
    uint surplus;  // Today's surplus (mined target tokens - the part to payoff unpaid cost) in incomeToken
    uint debt;  // The debt in paymentToken if today's mined target tokens cannot pay off cost
}

struct AppStorage {
    uint tokenCost; // cost per nft in payment token

    IERC1155Rewardable nft; // DeMineNFT contract address
    address paymentToken; // The type of token to pay off cost (e.g. USDT)
    address custodian; // payee account address, could be contract
    uint16 royaltyBps;  // royalty bps, 10000 based
    uint royaltyCap;  // max royalty value to accept

    mapping(uint => mapping(address => uint)) balances;  // owner => buyer => allowance

    // billing related
    mapping(uint256 => BillingStatement) statements; // Billing statement for each NFT token.
    address chainlink;
    address swapRouter;
    uint8 swapRouterVersion; // 2 or 3 supported
    uint16 earningTokenSaleDiscount10000Based; // 10000 based

    // primary market sale related
    mapping(address => bool) registeredPricingStrategy;
    mapping(address => address) pricingStrategy;
    mapping(address => mapping(address => bool)) approved; // for allowance
}

abstract contract StorageBase {
    AppStorage internal s;
}
