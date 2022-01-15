// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../shared/lib/LibPausable.sol';
import '../../nft/facets/ERC1155WithAgentFacet.sol';
import '../lib/AppStorage.sol';

/**
 * @title: RewardableFacet
 * @author: Shu Dong
 * @notice: deposit and extract income related functions
 */
contract PaycheckFacet is PausableModifier {
    AppStorage internal s;

    using SafeERC20 for IERC20;

    modifier onlyNFT() {
        require(
            msg.sender == address(s.nft),
            'DeMineNFTFacet: only nft contract is allowed'
        );
        _;
    }

    event Cashout(address indexed, uint256 income);
    event Paycheck(uint256 indexed, address, uint256, uint256);

    /**
     * @notice deposit income to current mining token
     * @params the address to deposit income
     * @params amount of income token to deposit
     */
    function paycheck(address source, uint256 amount) external onlyOwner {
        uint256 mining = s.mining;
        uint256 supply = s.info[mining].supply;
        if (supply > 0) {
            uint256 incomePerToken = amount / supply;
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
     * @params demine nft ids
     * @params amount per token to burn
     */
    function exchange(
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external whenNotPaused onlyNFT {
        uint256 total;
        for (uint256 i = 0; i < ids.length; i++) {
            require(ids[i] < s.mining, "DeMineNFT: unincomeed token");
            total += amounts[i] * s.info[ids[i]].income;
        }
        s.income.safeTransfer(msg.sender, total);
        emit Cashout(msg.sender, total);
    }

    /**
     * @notice get demine nft stats given list of nft ids
     * @params demine nft ids
     * @returns list of TokenInfo struct
     */
    function tokenInfo(uint256 ids) external view returns(TokenInfo[] memory) {
        TokenInfo[] result = new TokenInfo[]();
        for (uint i = 0; i < ids.length; i++) {
            result[i] = s.info[ids[i]]
        }
        return result;
    }
}
