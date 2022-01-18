// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/introspection/ERC165.sol';
import '@solidstate/contracts/token/ERC1155/base/ERC1155Base.sol';

import '../../shared/lib/LibPausable.sol';
import '../../shared/lib/LibTokenId.sol';
import '../interfaces/IDeMineNFT.sol';

contract ERC1155WithAgentFacet is
    IDeMineNFT,
    ERC1155Base,
    PausableModifier,
    ERC165
{
    AppStorage internal s;
    using SafeERC20 for IERC20;

    event Alchemy(address indexed operator, address indexed account, uint income);

    function finalizeCycle(address source, uint income) external onlyOwner {
        uint mining = s.mining;
        s.cycles[mining].income = income;
        uint supply = s.cycles[mining].supply;
        uint total = supply * income;
        if (total > 0) {
            s.income.safeTransferFrom(source, address(this), total);
        }
        emit Finalize(mining, source, income, supply);
        s.mining = mining + 1;
    }

    function alchemize(address account, uint id) external whenNotPaused override {
        TokenId memory id = LibTokenId.decode(id);
        require(id.cycle < s.mining, 'DeMineNFT: token not mined yet');
        require(
            msg.sender == account || isApprovedForAll(account, msg.sender),
            'DeMineNFT: operator is not caller or approved'
        );
        ERC1155BaseStorage.Layout storage balances = ERC1155BaseStorage.layout();
        balance = balances[id][account];
        uint income = balance * s.cycles[id.cycle].income * balance;
        s.income.safeTransfer(account, income);
        emit TransferSingle(msg.sender, account, address(0), id, balance);
        emit Alchemy(msg.sender, account, income);
    }

    function alchemizeBatch(
        address account,
        uint[] memory ids
    ) external override whenNotPaused returns(uint) {
        require(
            msg.sender == account || isApprovedForAll(account, msg.sender),
            'DeMineNFT: operator is not caller or approved'
        );
        ERC1155BaseStorage.Layout storage balances = ERC1155BaseStorage.layout();
        uint income;
        uint[] memory amounts = new uint[](ids.length);
        for (uint i; i < ids.length; i++) {
            TokenId memory id = LibTokenId.decode(ids[i]);
            require(id.cycle < s.mining, 'DeMineNFT: token not mined yet');
            uint balane = balances[id][account];
            balances[id][account] = 0;
            income += balance * s.cycles[id.cycle].income;
            amounts[i] = balance;
        }
        s.income.safeTransfer(account, income);
        emit TransferBatch(msg.sender, account, address(0), ids, amounts);
        emit Alchemy(msg.sender, account, income);
        return income;
    }

    function getMining() external view returns(uint128) {
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
