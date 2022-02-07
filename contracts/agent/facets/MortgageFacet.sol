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
 * @author Shu Dong
 * @notice Facet contract holding functions for miners to manage mortgage.
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
        s.income = IERC20(nftContract.earningToken());
        s.payment = IERC20(payment);
        s.payee = payee;
        s.tokenCost = tokenCost;
    }

    /**
     * @notice Pay token cost and liquidize tokens
     * @param ids DeMine nft token ids to redeem
     * @param amounts Amount of each demine nft token
     */
    function redeem(
        uint[] calldata ids,
        uint[] calldata amounts
    ) external whenNotPaused {
        require(
            ids.length == amounts.length,
            "DeMineAgent: array length mismatch"
        );
        uint tokenCost = s.tokenCost;
        uint billing = s.billing;
        uint totalCost;
        for (uint i = 0; i < ids.length; i++) {
            require(ids[i] >= billing, 'DeMineAgent: token not redeemable');
            totalCost += tokenCost * amounts[i];
            uint balance = s.balances[ids[i]][msg.sender];
            require(balance > amounts[i], 'DeMineAgent: no sufficient balance');
            s.balances[ids[i]][msg.sender] = balance - amounts[i];
        }
        s.payment.safeTransferFrom(msg.sender, s.payee, totalCost);
        emit Redeem(msg.sender, ids, amounts);
        s.nft.safeBatchTransferFrom(address(this), msg.sender, ids, amounts, "");
    }

    /**
     * @notice adjust deposit for msg sender and update account info
     *         Ensure you have a valid start and end set for msg.sender
     *         to prevent infinite loop
     */
    function adjustDeposit() external whenNotPaused {
        Account memory account = readAccount(msg.sender);
        require(account.start >= s.billing, 'DeMineAgent: payoff debt first');
        require(account.maxBalance > 0, 'DeMineAgent: no need to adjust');

        Account memory update = Account(account.start, account.end, 0);
        while (s.balances[update.start][msg.sender] == 0 && update.start <= update.end) {
            update.start += 1;
        }
        while (s.balances[update.end][msg.sender] == 0 && update.end >= update.start) {
            update.end -= 1;
        }
        if (update.start > update.end) {
            updateAccount(msg.sender, account, Account(type(uint).max, 0, 0));
        } else {
            for (uint id = update.start; id <= update.end; id++) {
                update.maxBalance = Util.max2(update.maxBalance, s.balances[id][msg.sender]);
            }
            updateAccount(msg.sender, account, update);
        }
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
        uint[] calldata ids
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
        Account memory account = readAccount(mortgager);
        Account memory update = Account(type(uint).max, 0, 0);
        for (uint i = 0; i < ids.length; i++) {
            uint balance = s.balances[ids[i]][mortgager] + amounts[i];
            s.balances[ids[i]][mortgager] = balance;
            update.maxBalance = Util.max2(balance, update.maxBalance);
            update.start = Util.min2(ids[i], update.start);
            update.end = Util.max2(ids[i], update.end);
        }
        mergeAccount(mortgager, account, update);
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    /**
     * @notice payoff debt from start to end. Ensure you have a
     *         valid start set to prevent infinite loop
     */
    function payoff(uint end) external whenNotPaused {
        uint income;
        uint debt;
        Account memory account = readAccount(msg.sender);
        require(end < s.billing, 'DeMineAgent: end larger than billing');
        for (uint id = account.start; id <= end; id++) {
            uint balance = s.balances[id][msg.sender];
            if (balance > 0) {
                Statement memory st = s.statements[id];
                income += st.income * balance / st.balance;
                debt += Util.ceil(st.debt * balance, st.balance);
                s.balances[id][msg.sender] = 0;
            }
        }
        s.accounts[msg.sender].start = end + 1;
        s.payment.safeTransferFrom(s.payee, msg.sender, debt);
        s.deposit += debt;
        s.income.safeTransfer(msg.sender, income);
    }

    function readAccount(
        address account
    ) private view returns(Account memory acc) {
        acc = s.accounts[account];
        acc.start = type(uint).max - acc.start;
        return acc;
    }

    function updateAccount(
        address account,
        Account memory current,
        Account memory update
    ) private {
        if (update.start > current.start) {
            s.accounts[account].start = type(uint).max - update.start;
        }
        if (update.end < current.end) {
            s.accounts[account].end = update.end;
        }
        if (update.maxBalance < current.maxBalance) {
            s.accounts[account].maxBalance = update.maxBalance;
            uint delta = (current.maxBalance - update.maxBalance) * depositBase();
            s.payment.safeTransfer(account, delta);
            s.deposit -= delta;
        }
    }

    function mergeAccount(
        address account,
        Account memory current,
        Account memory update
    ) private {
        if (update.start < current.start) {
            s.accounts[account].start = type(uint).max - update.start;
            current.start = update.start;
        }
        if (update.end > current.end) {
            s.accounts[account].start = update.start;
            current.end = update.end;
        }
        if (update.maxBalance > current.maxBalance) {
            s.accounts[account].maxBalance = update.maxBalance;
            current.maxBalance = update.maxBalance;
            uint delta = (update.maxBalance - current.maxBalance) * depositBase();
            s.payment.safeTransferFrom(msg.sender, s.payee, delta);
            s.deposit += delta;
        }
    }

    function depositBase() private view returns(uint) {
        return s.tokenCost * s.depositMultiplier;
    }
}
