// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@solidstate/contracts/access/OwnableInternal.sol';
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import '../lib/LibERC20Payable.sol';

contract ERC20PayableFacet is OwnableInternal {
    using EnumerableSet for EnumerableSet.AddressSet;

    event AddPayment(address indexed, bool);
    event RemovePayment(address indexed, bool);
    event SetChecking(address checking);
    event SetSaving(address checking);

    function addPayment(address payment, bool supported) external onlyOwner {
        LibERC20Payable.layout().payments.add(payment);
        emit AddPayment(payment, supported);
    }

    function removePayment(address payment, bool supported) external onlyOwner {
        LibERC20Payable.layout().payments.remove(payment);
        emit RemovePayment(payment, supported);
    }

    function supportedPayments() external view returns(address[] memory) {
        return LibERC20Payable.layout().payments.values();
    }

    function setCustodian(address custodian) external onlyOwner {
        LibERC20Payable.layout().custodian = custodian;
        emit SetChecking(checking);
    }

    function getCustodian() external view returns(address) {
        return LibERC20Payable.layout().custodian;
    }
}
