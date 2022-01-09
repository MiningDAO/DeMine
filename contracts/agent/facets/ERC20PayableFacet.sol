// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@solidstate/contracts/access/OwnableInternal.sol';
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import '../lib/LibERC20Payable.sol';

contract ERC20Payable is OwnableInternal {
    using EnumerableSet for EnumerableSet.AddressSet;

    event AddPayment(address indexed, bool);
    event RemovePayment(address indexed, bool);

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
}
