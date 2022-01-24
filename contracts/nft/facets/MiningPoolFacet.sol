// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/OwnableInternal.sol';
import '@solidstate/contracts/token/ERC1155/base/ERC1155BaseStorage.sol';
import '@solidstate/contracts/token/ERC1155/IERC1155Internal.sol';
import '@solidstate/contracts/token/ERC1155/IERC1155Receiver.sol';

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
    using SafeERC20 for IERC20;

    event Alchemy(address indexed account, uint income);
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

    function shrink(uint[] calldata ids) external override whenNotPaused {
        ERC1155BaseStorage.Layout storage l = ERC1155BaseStorage.layout();
        uint[] memory amounts = new uint[](ids.length);
        uint mining = s.mining;
        for (uint i; i < ids.length; i++) {
            require(ids[i] > mining, 'DeMineNFT: mined or mining token');
            uint balance = l.balances[ids[i]][msg.sender];
            s.tokens[ids[i]].supply -= balance;
            amounts[i] = balance;
            l.balances[ids[i]][msg.sender] = 0;
        }
        emit TransferBatch(msg.sender, msg.sender, address(0), ids, amounts);
    }

    function alchemize(
        uint[] calldata ids
    ) external override whenNotPaused returns(uint income) {
        ERC1155BaseStorage.Layout storage l = ERC1155BaseStorage.layout();
        uint mining = s.mining;
        uint[] memory amounts = new uint[](ids.length);
        for (uint i; i < ids.length; i++) {
            require(ids[i] < mining, 'DeMineNFT: token not mined yet');
            uint balance = l.balances[ids[i]][msg.sender];
            s.tokens[ids[i]].supply -= balance;
            l.balances[ids[i]][msg.sender] = 0;
            income += balance * s.tokens[ids[i]].income;
            amounts[i] = balance;
        }
        s.income.safeTransfer(msg.sender, income);
        emit TransferBatch(msg.sender, msg.sender, address(0), ids, amounts);
        emit Alchemy(msg.sender, income);
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
}
