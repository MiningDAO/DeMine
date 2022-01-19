// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/OwnableInternal.sol';
import '@solidstate/contracts/introspection/ERC165.sol';
import '@solidstate/contracts/token/ERC1155/base/ERC1155Base.sol';
import '@solidstate/contracts/utils/AddressUtils.sol';

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../shared/lib/LibPausable.sol';
import '../interfaces/IDeMineNFT.sol';
import '../lib/AppStorage.sol';

contract DeMineNFTFacet is
    IDeMineNFT,
    OwnableInternal,
    ERC1155Base,
    PausableModifier,
    ERC165
{
    AppStorage internal s;
    using SafeERC20 for IERC20;
    using AddressUtils for address;

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

    function registerAgent(address agent) external onlyOwner {
        require(agent.isContract(), 'DeMineNFT: agent is not contract');
        require(!s.agents[agent], 'DeMineNFT: agent already registered');
        s.agents[agent] = true;
        emit RegisterAgent(agent);
    }

    function mint(
        address agent,
        uint[] calldata ids,
        uint[] calldata amounts,
        bytes memory data
    ) external onlyOwner {
        require(s.agents[agent], 'DeMineNFT: agent not registered');
        _safeMintBatch(agent, ids, amounts, data);
        for (uint i; i < ids.length; i++) {
            s.tokens[ids[i]].supply += amounts[i];
        }
    }

    function shrink(address account, uint[] calldata ids)
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

    function alchemize(address account, uint id)
        external
        whenNotPaused
        override
        returns(uint income)
    {
        require(id < s.mining, 'DeMineNFT: token not mined yet');
        require(
            msg.sender == account || isApprovedForAll(account, msg.sender),
            'DeMineNFT: operator is not caller or approved'
        );
        ERC1155BaseStorage.Layout storage l = ERC1155BaseStorage.layout();
        uint balance = l.balances[id][account];
        income = s.tokens[id].income * balance;
        s.income.safeTransfer(account, income);
        emit TransferSingle(msg.sender, account, address(0), id, balance);
        emit Alchemy(msg.sender, account, income);
    }

    function alchemizeBatch(
        address account,
        uint[] calldata ids
    ) external override whenNotPaused returns(uint income) {
        require(
            msg.sender == account || isApprovedForAll(account, msg.sender),
            'DeMineNFT: operator is not caller or approved'
        );
        ERC1155BaseStorage.Layout storage l = ERC1155BaseStorage.layout();
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

    function getTokenInfo(uint256 id) external view returns(Token memory) {
        return s.tokens[id];
    }

    function isAgentRegistered(address agent) external view returns(bool) {
        return s.agents[agent];
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
