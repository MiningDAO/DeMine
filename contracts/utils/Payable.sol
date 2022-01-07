// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@solidstate/contracts/access/OwnableInternal.sol';
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import './PayableInternal.sol';

abstract contract Payable is PayableInternal, OwnableInternal {
    using EnumerableSet for EnumerableSet.AddressSet;

    event EnablePayment(address indexed, bool);
    event DisablePayment(address indexed, bool);

    function enablePayment(address payment, bool supported) external onlyOwner {
        PayableStorage.layout().payments.add(payment);
        emit EnablePayment(payment, supported);
    }

    function disablePayment(address payment, bool supported) external onlyOwner {
        PayableStorage.layout().payments.remove(payment);
        emit DisablePayment(payment, supported);
    }

    function supportedPayments() external view returns(address[] memory) {
        PayableStorage.layout().payments.values();
    }
}
