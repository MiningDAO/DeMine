// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/access/OwnableInternal.sol';
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import '../lib/LibERC20Payable.sol';

contract ERC20PayableFacet is OwnableInternal {
    using EnumerableSet for EnumerableSet.AddressSet;
    AppStorage internal s;

    event SetPayment(address indexed, bool, uint8);
    event SetCustodian(address custodian);

    function setPayment(
        address payment,
        bool supported,
        uint8 decimals
    ) external onlyOwner {
        s.payments[payment].decimals = decimals;
        emit SetPayment(payment, supported, decimals);
    }

    function paymentInfo(address payment)
        external
        view
        returns(bool, uint8)
    {
        return (
            s.payments[payment].supported,
            s.payments[payment].decimals
        );
    }

    function setCustodian(address custodian) external onlyOwner {
        s.custodian = custodian;
        emit SetChecking(checking);
    }

    function getCustodian() external view returns(address) {
        return s.custodian;
    }
}
