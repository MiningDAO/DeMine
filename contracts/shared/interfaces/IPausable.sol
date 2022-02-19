// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

interface IPausable {
    /**
     * @dev Emitted when paused by `account`.
     */
    event Paused(address account);

    /**
     * @dev Emitted when unpaused by `account`.
     */
    event Unpaused(address account);

    /**
     * @dev Should return if the contract is paused
     */
    function paused() external view returns (bool);

    /**
     * @dev pause the contract
     */
    function pause() external;

    /**
     * @dev unpause the contract
     */
    function unpause() external;
}
