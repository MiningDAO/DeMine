// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/OwnableInternal.sol';

import '../lib/AppStorage.sol';

abstract contract Base is OwnableInternal {
    AppStorage internal s;
}
