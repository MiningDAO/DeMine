// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/access/OwnableInternal.sol';
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import '../lib/LibERC20Payable.sol';

contract ERC20PayableFacet is OwnableInternal {
    using EnumerableSet for EnumerableSet.AddressSet;
    AppStorage internal s;

    event AddPayment(address indexed, bool);
    event RemovePayment(address indexed, bool);
    event SetCustodian(address custodian);

    function addPayment(address payment, bool supported) external onlyOwner {
        s.payments.add(payment);
        emit AddPayment(payment, supported);
    }

    function removePayment(address payment, bool supported) external onlyOwner {
        s.payments.remove(payment);
        emit RemovePayment(payment, supported);
    }

    function supportedPayments() external view returns(address[] memory) {
        return s.payments.values();
    }

    function setCustodian(address custodian) external onlyOwner {
        s.custodian = custodian;
        emit SetChecking(checking);
    }

    function getCustodian() external view returns(address) {
        return s.custodian;
    }
}
