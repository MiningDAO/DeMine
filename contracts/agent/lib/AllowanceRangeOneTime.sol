// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
pragma experimental ABIEncoderV2;

import '../interfaces/IAllowanceStrategy.sol';
import './AllowanceRangeOneTimeStorage.sol';

contract AllowanceRangeOneTime is IAllowanceStrategy {
    function set(
        address owner,
        address buyer,
        bytes memory args
    ) external override {
        AllowanceRangeOneTimeStorage.Layout storage l =
            AllowanceRangeOneTimeStorage.layout();
        AllowanceRangeOneTimeStorage.RangeAllowance memory toSet =
            abi.decode(args, (AllowanceRangeOneTimeStorage.RangeAllowance));
        require(
            l.allowances[owner][buyer].allowance == 0 || toSet.allowance == 0,
            'AllowanceRange: reset allowace to 0 first'
        );
        l.allowances[owner][buyer] = toSet;
    }

    function checkAllowances(
        address owner,
        address buyer,
        uint[] memory ids,
        uint[] memory amounts
    ) external override {
        AllowanceRangeOneTimeStorage.Layout storage l
            = AllowanceRangeOneTimeStorage.layout();
        AllowanceRangeOneTimeStorage.RangeAllowance memory range =
            l.allowances[owner][buyer];
        for (uint i = 0; i < ids.length; i++) {
            uint128 start = uint128(ids[i] >> 128);
            uint128 end = uint128(ids[i]);
            require(
                start >= range.start && end <= range.end && amounts[i] <= range.allowance,
                'AllowanceRange: insufficient allowance'
            );
        }
        l.allowances[owner][buyer].allowance = 0;
    }

    function allowanceOfBatch(
        address owner,
        address buyer,
        uint[] memory ids
    ) external override view returns(uint[] memory) {
        AllowanceRangeOneTimeStorage.RangeAllowance memory range =
            AllowanceRangeOneTimeStorage.layout().allowances[owner][buyer];
        uint[] memory allowances = new uint[](ids.length);
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
