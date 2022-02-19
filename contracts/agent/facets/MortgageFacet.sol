// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/introspection/ERC165.sol';
import '@solidstate/contracts/token/ERC1155/IERC1155Receiver.sol';

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../shared/lib/Util.sol';
import '../../shared/lib/LibPausable.sol';
import '../lib/AppStorage.sol';
import '../lib/BillingStorage.sol';
import '../../shared/lib/LibInitializable.sol';

/**
 * @title MortgageFacet
 * @author Shu Dong, Yijie Hong
 * @notice Facet contract holding functions for miners to manage mortgage.
 * @notice Facet contract currently only supports weekly NFT token.
 * @dev the contract also implements IERC1155Receiver to receive and lock demine nft
 */
contract MortgageFacet is
    Initializable,
    PausableModifier,
    IERC1155Receiver,
    ERC165
{
    AppStorage internal s;

    using SafeERC20 for IERC20;

    event Redeem(address indexed, uint[], uint[]);

    function init(
        address nft,
        address payment,
        address payee,
        uint tokenCost
    ) external onlyInitializing {
        IERC1155Rewardable nftContract = IERC1155Rewardable(nft);
        s.nft = nftContract;
        s.incomeToken = IERC20(nftContract.earningToken());
        s.paymentToken = IERC20(payment);
        s.payee = payee;
        s.tokenCost = tokenCost;
    }

    /**
     * @notice Pay token cost and liquidize tokens
     * @param ids DeMine nft token ids to redeem
     * @param amounts Amount of each demine nft token
     */
    function redeemNFT(
        uint256[] calldata ids,
        uint[] calldata amounts
    ) external whenNotPaused {
        require(
            ids.length == amounts.length,
            "DeMineAgent: array length mismatch");
        uint tokenCost = s.tokenCost;
        uint128 finalizedEnd = s.finalizedEnd;

        Account memory account = s.accounts[msg.sender];

        uint totalCost;
        for (uint i = 0; i < ids.length; i++) {
            require(
                tokenIdToStart(ids[i]) >= finalizedEnd,
                "DeMineAgent: cannot redeem NFT for ongoing/completed mining.");
            require(isWeeklyToken(ids[i]), "DeMineAgent: Only weekly token is supported");
            totalCost += tokenCost * amounts[i] * daysInWeek();
            uint balance = s.balances[ids[i]][msg.sender];
            require(balance > 0 && balance > amounts[i], 'DeMineAgent: no sufficient balance');
            s.balances[ids[i]][msg.sender] = balance - amounts[i];
        }
        if (totalCost > 0) {
            s.paymentToken.safeTransferFrom(msg.sender, s.payee, totalCost);
        }
        emit Redeem(msg.sender, ids, amounts);
        s.nft.safeBatchTransferFrom(address(this), msg.sender, ids, amounts, "");
    }

    /**
     * @notice adjust accounts for msg sender for valid weeklyTokenLockStart and
     *         weeklyTokenLockEnd times for msg.sender to prevent infinite loop.
     *         weeklyTokenLockStart and weeklyTokenLockEnd could be inaccurate
     *         after redeemNFT().
     */
    function correctAccount() external whenNotPaused {
        Account memory current = s.accounts[msg.sender];
        Account memory update = Account(
            current.weeklyTokenLockStart,
            current.weeklyTokenLockEnd);

        // Correct account for weekly token.
        uint256 lockedWeeklyToken = getWeeklyTokenFromStartTime(update.weeklyTokenLockStart);
        while(tokenIdToEnd(lockedWeeklyToken) <= update.weeklyTokenLockEnd) {
            if (s.balances[lockedWeeklyToken][msg.sender] == 0 &&
                update.weeklyTokenLockStart <= update.weeklyTokenLockEnd) {
                update.weeklyTokenLockStart += 604800;
            } else {
                break;
            }
            lockedWeeklyToken = nextWeeklyTokenId(lockedWeeklyToken);
        }
        lockedWeeklyToken = getWeeklyTokenFromEndTime(update.weeklyTokenLockEnd);
        while(tokenIdToStart(lockedWeeklyToken) >= update.weeklyTokenLockStart) {
            if (s.balances[lockedWeeklyToken][msg.sender] == 0 &&
                update.weeklyTokenLockStart <= update.weeklyTokenLockEnd) {
                update.weeklyTokenLockEnd -= 604800;
            } else {
                break;
            }
            lockedWeeklyToken = previousWeeklyTokenId(lockedWeeklyToken);
        }
        updateAccount(msg.sender, current, update);
    }

    /**
     * @notice get account info
     * @param account Address of account to query
     */
    function getAccountInfo(address account) external view returns(Account memory) {
        return s.accounts[account];
    }

    function balanceOfBatch(
        address account,
        uint256[] calldata ids
    ) external view returns(uint[] memory) {
        uint[] memory balances = new uint[](ids.length);
        for (uint i = 0; i < ids.length; i++) {
            balances[i] = s.balances[ids[i]][account];
        }
        return balances;
    }

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return 0; // reject
    }

    // @dev the function should only be called by mint function of DeMineNFT
    // @param from Must be address(0)
    // @param data Must be encoded address of mortagager
    function onERC1155BatchReceived(
        address,
        address from,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external override returns (bytes4) {
        require(
            msg.sender == address(s.nft) && from == address(0),
            'DeMineAgent: only minted tokens from DeMineNFT allowed'
        );
        (address mortgager) = abi.decode(data, (address));
        Account memory current = s.accounts[mortgager];
        Account memory update = Account(
            current.weeklyTokenLockStart,
            current.weeklyTokenLockEnd);
        for (uint i = 0; i < ids.length; i++) {
            require(isWeeklyToken(ids[i]), "DeMineAgent: Only weekly token is supported");
            uint balance = s.balances[ids[i]][mortgager] + amounts[i];
            s.balances[ids[i]][mortgager] = balance;

            update.weeklyTokenLockStart = Util.uint128min2(tokenIdToStart(ids[i]), update.weeklyTokenLockStart);
            update.weeklyTokenLockEnd = Util.uint128max2(tokenIdToEnd(ids[i]), update.weeklyTokenLockEnd);
        }
        updateAccount(msg.sender, current, update);
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    /**
     * @notice payoff debt from start to end. Ensure you have a
     *         valid start set to prevent infinite loop
     */
    function payoff(uint128 end) external whenNotPaused {
        uint income;
        uint debt;
        require(end % 86400 == 0, "DeMineAgent: invalid payoff end time");
        Account memory account = s.accounts[msg.sender];
        require(end <= s.finalizedEnd, 'DeMineAgent: cannot payoff unfinalized NFTs');

        // Payoff weekly token
        uint256 lockedWeeklyToken = getWeeklyTokenFromStartTime(account.weeklyTokenLockStart);
        while(tokenIdToEnd(lockedWeeklyToken) <= end) {
            uint balance = s.balances[lockedWeeklyToken][msg.sender];
            if (balance > 0) {
                uint128 lastDayEnd = tokenIdToEnd(lockedWeeklyToken);
                uint128 firstDayEnd = lastDayEnd - (uint128(daysInWeek()) - 1) * 86400;
                for (uint128 dailyEnd = firstDayEnd; dailyEnd<= lastDayEnd; dailyEnd + 86400) {
                    DailyStatement memory st = s.statements[dailyEnd];
                    income += st.surplus * balance / st.balance;
                    debt += st.debt * balance / st.balance;
                }
                s.balances[lockedWeeklyToken][msg.sender] = 0;
            }
            lockedWeeklyToken = nextWeeklyTokenId(lockedWeeklyToken);
        }
        s.accounts[msg.sender].weeklyTokenLockStart = tokenIdToStart(lockedWeeklyToken);

        if (debt > 0) {
            s.paymentToken.safeTransferFrom(s.payee, msg.sender, debt);
        }
        s.incomeToken.safeTransfer(msg.sender, income);
    }

    function updateAccount(
        address account,
        Account memory current,
        Account memory update
    ) private {
        s.accounts[account].weeklyTokenLockStart = update.weeklyTokenLockStart;
        s.accounts[account].weeklyTokenLockEnd = update.weeklyTokenLockEnd;
    }

    function tokenIdToStart(uint256 tokenId) private pure returns(uint128) {
        return uint128(tokenId >> 128);
    }

    function tokenIdToEnd(uint256 tokenId) private pure returns(uint128) {
        return uint128(tokenId);
    }

    function isWeeklyToken(uint256 tokenId) private pure returns(bool) {
        return (tokenIdToEnd(tokenId) - tokenIdToStart(tokenId)) == 604800;
    }

    function daysInWeek() private pure returns(uint) {
        return 7;
    }

    // nextWeeklyTokenId assumes weekly tokens are created every 7 days.
    function nextWeeklyTokenId(uint256 tokenId) private pure returns(uint256) {
        return uint256(uint256(tokenIdToEnd(tokenId)) << 128 | (tokenIdToEnd(tokenId) + 604800));
    }

    // previousWeeklyTokenId assumes weekly tokens are created every 7 days.
    function previousWeeklyTokenId(uint256 tokenId) private pure returns(uint256) {
        return uint256(uint256(tokenIdToStart(tokenId) - 604800) << 128 | (tokenIdToStart(tokenId)));
    }

    function getWeeklyTokenFromStartTime(uint128 start) private pure returns(uint256) {
        return nextWeeklyTokenId(uint256(start));
    }

    function getWeeklyTokenFromEndTime(uint128 end) private pure returns(uint256) {
        return previousWeeklyTokenId(uint256(end) << 128);
    }
}
