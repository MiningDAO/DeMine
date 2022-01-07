// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import './PayableStorage.sol';

abstract contract PayableInternal {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    modifier onlyPayable(address payment) {
        require(
            PayableStorage.layout().payments.contains(payment),
            "DeMineAgent: payment not supported"
        );
        _;
    }

    function pay(
        address payment,
        address payee,
        uint256 amount
    ) internal onlyPayable(payment) {
        IERC20(payment).safeTransfer(payee, amount);
    }

    function payFrom(
        address payment,
        address payer,
        address payee,
        uint256 amount
    ) internal onlyPayable(payment) {
        IERC20(payment).safeTransferFrom(payer, payee, amount);
    }
}
