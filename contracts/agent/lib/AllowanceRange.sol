// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
pragma experimental ABIEncoderV2;

import '../interfaces/IAllowance.sol';
import './AllowanceRangeStorage.sol';

contract AllowanceRange is IAllowance {
    function set(
        address owner,
        address buyer,
        bytes memory args
    ) external override {
        AllowanceRangeStorage.Layout storage l =
            AllowanceRangeStorage.layout();
        AllowanceRangeStorage.RangeAllowance memory toSet =
            abi.decode(args, (AllowanceRangeStorage.RangeAllowance));
        require(
            l.allowances[owner][buyer].allowance == 0 || toSet.allowance == 0,
            'AllowanceRange: reset allowace to 0 first'
        );
        l.allowances[owner][buyer] = toSet;
    }

    function allowanceOfBatch(
        address owner,
        address buyer,
        uint[] memory ids
    ) external override view returns(uint[] memory) {
        AllowanceRangeStorage.Layout storage l =
            AllowanceRangeStorage.layout();
        uint[] memory allowances = new uint[](ids.length);
        AllowanceRangeStorage.RangeAllowance memory range =
            l.allowances[owner][buyer];
        for (uint i = 0; i < ids.length; i++) {
            uint128 start = uint128(ids[i] >> 128);
            uint128 end = uint128(ids[i]);
            if (start >= range.start && end <= range.end) {
                allowances[i] = range.allowance;
            }
        }
        return allowances;
    }
}
