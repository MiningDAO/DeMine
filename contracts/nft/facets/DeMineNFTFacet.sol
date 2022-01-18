// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/introspection/ERC165.sol';
import '@solidstate/contracts/token/ERC1155/base/ERC1155Base.sol';

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../shared/lib/LibPausable.sol';
import '../../shared/lib/LibTokenId.sol';
import '../interfaces/IDeMineNFT.sol';
import '../lib/AppStorage.sol';

contract DeMineNFTFacet is
    IDeMineNFT,
    ERC1155Base,
    PausableModifier,
    ERC165
{
    AppStorage internal s;
    using SafeERC20 for IERC20;

    event Alchemy(address indexed operator, address indexed account, uint income);

    function shrink(address account, uint[] memory ids)
        external
        override
        whenNotPaused
    {
        require(
            msg.sender == account || isApprovedForAll(account, msg.sender),
            'DeMineNFT: operator is not caller or approved'
        );
        ERC1155BaseStorage.Layout storage l = ERC1155BaseStorage.layout();
        uint[] memory amounts = new uint[](ids.length);
        uint128 mining = s.mining;
        for (uint i; i < ids.length; i++) {
            uint128 cycle = LibTokenId.decode(ids[i]).cycle;
            require(cycle >= mining, 'DeMineNFT: mined cycle');
            uint balance = l.balances[ids[i]][account];
            s.cycles[cycle].supply -= balance;
            amounts[i] = balance;
            l.balances[ids[i]][account] = 0;
        }
        emit TransferBatch(msg.sender, account, address(0), ids, amounts);
    }

    function alchemize(address account, uint id)
        external
        whenNotPaused
        override
        returns(uint income)
    {
        uint128 cycle = LibTokenId.decode(id).cycle;
        require(cycle < s.mining, 'DeMineNFT: token not mined yet');
        require(
            msg.sender == account || isApprovedForAll(account, msg.sender),
            'DeMineNFT: operator is not caller or approved'
        );
        ERC1155BaseStorage.Layout storage l = ERC1155BaseStorage.layout();
        uint balance = l.balances[id][account];
        income = s.cycles[cycle].income * balance;
        s.income.safeTransfer(account, income);
        emit TransferSingle(msg.sender, account, address(0), id, balance);
        emit Alchemy(msg.sender, account, income);
    }

    function alchemizeBatch(
        address account,
        uint[] memory ids
    ) external override whenNotPaused returns(uint income) {
        require(
            msg.sender == account || isApprovedForAll(account, msg.sender),
            'DeMineNFT: operator is not caller or approved'
        );
        ERC1155BaseStorage.Layout storage l = ERC1155BaseStorage.layout();
        uint mining = s.mining;
        uint[] memory amounts = new uint[](ids.length);
        for (uint i; i < ids.length; i++) {
            uint128 cycle = LibTokenId.decode(ids[i]).cycle;
            require(cycle < mining, 'DeMineNFT: token not mined yet');
            uint balance = l.balances[ids[i]][account];
            l.balances[ids[i]][account] = 0;
            income += balance * s.cycles[cycle].income;
            amounts[i] = balance;
        }
        s.income.safeTransfer(account, income);
        emit TransferBatch(msg.sender, account, address(0), ids, amounts);
        emit Alchemy(msg.sender, account, income);
        return income;
    }

    function getMining() external view override returns(uint128) {
        return s.mining;
    }

    function getCycle(uint128 cycle) external view returns(Cycle memory) {
        return s.cycles[cycle];
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint[] memory ids,
        uint[] memory amounts,
        bytes memory data
    ) internal whenNotPaused virtual override(ERC1155BaseInternal) {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }
}
