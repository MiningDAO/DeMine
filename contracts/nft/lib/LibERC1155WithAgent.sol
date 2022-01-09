// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

library LibERC1155WithAgent {
    struct Layout {
        address agent;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('solidstate.contracts.storage.ERC1155WithAgent');

    function layout() internal pure returns(Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }

    function setAgent(Layout storage l, address agent) internal {
        require(
            l.agent == address(0) && agent != address(0),
            "DeMineNFT: agent already set or agent to set is zero address"
        );
        l.agent = agent;
    }
}
