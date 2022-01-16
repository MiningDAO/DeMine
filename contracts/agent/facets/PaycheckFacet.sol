// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/OwnableInternal.sol';
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../shared/lib/LibPausable.sol';
import '../../nft/facets/ERC1155WithAgentFacet.sol';
import '../lib/AppStorage.sol';

/**
 * @title RewardableFacet
 * @author Shu Dong
 * @notice deposit and cashout related functions
 */
contract PaycheckFacet is PausableModifier, OwnableInternal {
    AppStorage internal s;

    using SafeERC20 for IERC20;

    modifier onlyNFT() {
        require(
            msg.sender == address(s.nft),
            'DeMineNFTFacet: only nft contract is allowed'
        );
        _;
    }

    event Cashout(address indexed, uint income);
    event Paycheck(uint indexed, address, uint, uint);

    /**
     * @notice deposit income to current mining token
     * @param source The address to deposit income
     * @param amount The amount of income token to deposit
     */
    function paycheck(address source, uint amount) external onlyOwner {
        uint mining = s.mining;
        uint supply = s.info[mining].supply;
        if (supply > 0) {
            uint incomePerToken = amount / supply;
            s.info[mining].income += incomePerToken;
            s.income.safeTransferFrom(
                source,
                address(this),
                supply * incomePerToken
            );
            emit Paycheck(mining, source, incomePerToken, supply);
        }
    }

    /**
     * @notice burn DeMineNFT tokens to cashout income tokens
     * @param recipient Address to receive cashed out reward
     * @param ids DeMineNFT id list
     * @param amounts Amount per token to cashout
     */
    function cashout(
        address recipient,
        uint[] calldata ids,
        uint[] calldata amounts
    ) external whenNotPaused onlyNFT {
        uint total;
        for (uint i = 0; i < ids.length; i++) {
            require(ids[i] < s.mining, "DeMineNFT: token not mined yet");
            total += amounts[i] * s.info[ids[i]].income;
        }
        s.income.safeTransfer(recipient, total);
        emit Cashout(recipient, total);
    }

    /**
     * @notice withdraw income and pay debt for tokens already billed
     * @param ids DeMine NFT ids to withdraw
     */
    function withdraw(uint256[] calldata ids) external whenNotPaused {
        uint256 totalReward;
        uint256 totalDebt;
        for (uint i = 0; i < ids.length; i++) {
            require(ids[i] <= s.billing, 'DeMineAgent: not billed yet');
            uint256 balance = s.balances[ids[i]][msg.sender];
            TokenInfo memory info = s.info[ids[i]];
            totalReward += (info.income - info.adjust) * balance;
            totalDebt += info.debt * balance;
            s.balances[ids[i]][msg.sender] = 0;
        }
        s.cost.safeTransferFrom(msg.sender, address(this), totalDebt);
        s.income.safeTransfer(msg.sender, totalReward);
    }

    /**
     * @notice get demine nft stats given list of nft ids
     * @param ids DeMineNFT id list
     * @return list of TokenInfo struct
     */
    function tokenInfo(uint[] calldata ids) external view returns(TokenInfo[] memory) {
        TokenInfo[] memory result = new TokenInfo[](ids.length);
        for (uint i = 0; i < ids.length; i++) {
            result[i] = s.info[ids[i]];
        }
        return result;
    }
}
