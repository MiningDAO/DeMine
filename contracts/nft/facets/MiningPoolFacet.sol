// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/OwnableInternal.sol';
import '@solidstate/contracts/token/ERC1155/base/ERC1155BaseStorage.sol';
import '@solidstate/contracts/token/ERC1155/IERC1155Internal.sol';
import '@solidstate/contracts/token/ERC1155/IERC1155Receiver.sol';
import '@solidstate/contracts/utils/AddressUtils.sol';

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../shared/lib/LibPausable.sol';
import '../interfaces/IMiningPool.sol';
import '../lib/AppStorage.sol';

contract MiningPoolFacet is
    IERC1155Internal,
    IMiningPool,
    OwnableInternal,
    PausableModifier
{
    AppStorage internal s;
    using AddressUtils for address;
    using SafeERC20 for IERC20;

    event Alchemy(address indexed operator, address indexed account, uint income);
    event RegisterAgent(address indexed);
    event Finalize(uint indexed, address, uint, uint);

    function finalize(address source, uint income) external onlyOwner {
        uint mining = s.mining;
        s.tokens[mining].income = income;
        uint supply = s.tokens[mining].supply;
        uint total = supply * income;
        if (total > 0) {
            s.income.safeTransferFrom(source, address(this), total);
        }
        emit Finalize(mining, source, income, supply);
        s.mining = mining + 1;
    }

    function expand(
        address recipient,
        uint[] calldata ids,
        uint[] calldata amounts,
        bytes memory data
    ) external onlyOwner {
        ERC1155BaseStorage.Layout storage l = ERC1155BaseStorage.layout();
        for (uint i; i < ids.length; i++) {
            require(ids[i] > s.mining, 'DeMineNFT: mined or mining token');
            s.tokens[ids[i]].supply += amounts[i];
            l.balances[ids[i]][recipient] += amounts[i];
        }
        _doSafeBatchTransferAcceptanceCheck(
            msg.sender, address(0), recipient, ids, amounts, data
        );
        emit TransferBatch(msg.sender, address(0), recipient, ids, amounts);
    }

    function shrink(address account, uint[] calldata ids)
        external
        override
        whenNotPaused
    {
        ERC1155BaseStorage.Layout storage l = ERC1155BaseStorage.layout();
        require(
            msg.sender == account || l.operatorApprovals[account][msg.sender],
            'DeMineNFT: operator is not caller or approved'
        );
        uint[] memory amounts = new uint[](ids.length);
        uint mining = s.mining;
        for (uint i; i < ids.length; i++) {
            require(ids[i] >= mining, 'DeMineNFT: mined token');
            uint balance = l.balances[ids[i]][account];
            s.tokens[ids[i]].supply -= balance;
            amounts[i] = balance;
            l.balances[ids[i]][account] = 0;
        }
        emit TransferBatch(msg.sender, account, address(0), ids, amounts);
    }

    function alchemize(
        address account,
        uint[] calldata ids
    ) external override whenNotPaused returns(uint income) {
        ERC1155BaseStorage.Layout storage l = ERC1155BaseStorage.layout();
        require(
            msg.sender == account || l.operatorApprovals[account][msg.sender],
            'DeMineNFT: operator is not caller or approved'
        );
        uint mining = s.mining;
        uint[] memory amounts = new uint[](ids.length);
        for (uint i; i < ids.length; i++) {
            require(ids[i] < mining, 'DeMineNFT: token not mined yet');
            uint balance = l.balances[ids[i]][account];
            l.balances[ids[i]][account] = 0;
            income += balance * s.tokens[ids[i]].income;
            amounts[i] = balance;
        }
        s.income.safeTransfer(account, income);
        emit TransferBatch(msg.sender, account, address(0), ids, amounts);
        emit Alchemy(msg.sender, account, income);
        return income;
    }

    function getMining() external view override returns(uint) {
        return s.mining;
    }

    function treasureSource() external override view returns(address) {
        return address(s.income);
    }

    function getTokenInfo(uint256 id) external view returns(Token memory) {
        return s.tokens[id];
    }

    function _doSafeBatchTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) private {
        if (to.isContract()) {
            try IERC1155Receiver(to).onERC1155BatchReceived(operator, from, ids, amounts, data) returns (
                bytes4 response
            ) {
                if (response != IERC1155Receiver.onERC1155BatchReceived.selector) {
                    revert("ERC1155: ERC1155Receiver rejected tokens");
                }
            } catch Error(string memory reason) {
                revert(reason);
            } catch {
                revert("ERC1155: transfer to non ERC1155Receiver implementer");
            }
        }
    }
}
