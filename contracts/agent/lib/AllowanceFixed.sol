// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
pragma experimental ABIEncoderV2;

import '../interfaces/IAllowanceStrategy.sol';
import './AllowanceFixedStorage.sol';

contract AllowanceFixed is IAllowanceStrategy {
    function set(
        address owner,
        address buyer,
        bytes memory args
    ) external override {
        AllowanceFixedStorage.Layout storage l
            = AllowanceFixedStorage.layout();
        uint allowance = abi.decode(args, (uint));
        require(
            l.allowances[owner][buyer] == 0 || allowance == 0,
            'AllowanceStatic: reset allowance to 0 first'
        );
        l.allowances[owner][buyer] = allowance;
    }

    function allowanceOfBatch(
        address owner,
        address buyer,
        uint[] memory ids
    ) external override view returns(uint[] memory) {
        AllowanceFixedStorage.Layout storage l
            = AllowanceFixedStorage.layout();
        uint[] memory allowances = new uint[](ids.length);
        uint allowance = l.allowances[owner][buyer];
        for (uint i = 0; i < ids.length; i++) {
            allowances[i] = allowance;
        }
        return allowances;
    }
}
