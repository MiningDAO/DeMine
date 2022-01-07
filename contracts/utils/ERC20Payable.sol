// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@solidstate/contracts/access/OwnableInternal.sol';
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import './ERC20PayableInternal.sol';

contract ERC20Payable is ERC20PayableInternal, OwnableInternal {
    using EnumerableSet for EnumerableSet.AddressSet;

    event EnablePayment(address indexed, bool);
    event DisablePayment(address indexed, bool);

    function enablePayment(address payment, bool supported) external onlyOwner {
        ERC20PayableStorage.layout().payments.add(payment);
        emit EnablePayment(payment, supported);
    }

    function disablePayment(address payment, bool supported) external onlyOwner {
        ERC20PayableStorage.layout().payments.remove(payment);
        emit DisablePayment(payment, supported);
    }

    function supportedPayments() external view returns(address[] memory) {
        return ERC20PayableStorage.layout().payments.values();
    }
}
