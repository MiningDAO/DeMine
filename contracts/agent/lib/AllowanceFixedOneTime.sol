// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
pragma experimental ABIEncoderV2;

import '../../shared/lib/Util.sol';
import '../interfaces/IAllowanceStrategy.sol';
import './AllowanceFixedOneTimeStorage.sol';

contract AllowanceFixedOneTime is IAllowanceStrategy {
    function set(
        address owner,
        address buyer,
        bytes memory args
    ) external override {
        AllowanceFixedOneTimeStorage.Layout storage l
            = AllowanceFixedOneTimeStorage.layout();
        uint allowance = abi.decode(args, (uint));
        require(
            l.allowances[owner][buyer] == 0 || allowance == 0,
            'AllowanceStatic: reset allowance to 0 first'
        );
        l.allowances[owner][buyer] = allowance;
    }

    function checkAllowances(
        address owner,
        address buyer,
        uint[] memory ids,
        uint[] memory amounts
    ) external override {
        AllowanceFixedOneTimeStorage.Layout storage l
            = AllowanceFixedOneTimeStorage.layout();
        uint allowance = l.allowances[owner][buyer];
        for (uint i = 0; i < ids.length; i++) {
            require(
                amounts[i] <= allowance,
                'AllowanceFixed: insufficient allowance'
            );
        }
        l.allowances[owner][buyer] = 0;
    }

    function allowanceOfBatch(
        address owner,
        address buyer,
        uint[] memory ids
    ) external override view returns(uint[] memory) {
        AllowanceFixedOneTimeStorage.Layout storage l
            = AllowanceFixedOneTimeStorage.layout();
        uint[] memory allowances = new uint[](ids.length);
        uint allowance = l.allowances[owner][buyer];
        for (uint i = 0; i < ids.length; i++) {
            allowances[i] = allowance;
        }
        return allowances;
    }
}
