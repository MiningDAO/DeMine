// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import '../../nft/facets/ERC1155WithAgentFacet.sol';

struct Mortgage {
    address owner;
    uint start;
    uint end;
    uint supply;
    uint deposit;
}

struct TokenInfo {
    uint income; // per token
    uint supply;
    // after billing
    uint adjust; // per token
    uint debt; // per token
}

struct AppStorage {
    ERC1155WithAgentFacet nft;

    uint8 minDepositDaysRequired;
    IERC20 cost;
    IERC20 income;
    uint tokenCost; // cost token
    uint deposit; // cost token

    uint mining; // mining token
    uint billing; // billing token
    uint shrinked; // shrinking token
    uint8 shrinkSize; // num of tokens we shrink starting from next rewarding token

    // mortgage
    uint mortgage;
    mapping(uint => Mortgage) mortgages; // mortgage index as key
    mapping(uint => TokenInfo) info; // token id as key

    // tokenId => account => price
    mapping(uint => mapping(address => uint)) balances;
    // owner => buyer => allowance
    mapping(address => mapping(address => mapping(uint => uint))) allowances;
}

library LibAppStorage {
    function layout() internal pure returns(AppStorage storage s) {
        assembly {
            s.slot := 0
        }
    }

}
