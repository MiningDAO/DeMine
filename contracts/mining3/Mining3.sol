// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Arrays.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Mining3 is ERC20, Ownable, Pausable {
    using Arrays for uint256[];
    using SafeERC20 for IERC20;

    struct Withdrawal {
        uint256 snapshotId;
        uint256 index;
    }

    uint256 private _finalized;
    address private _earningToken;
    mapping(address => Withdrawal) _withdrawals;
    mapping(uint256 => uint256) _earnings;

    struct Snapshots {
        uint256[] ids;
        uint256[] values;
    }
    mapping(address => Snapshots) private _accountBalanceSnapshots;
    Snapshots private _totalSupplySnapshots;

    constructor(
        string memory name,
        string memory symbol,
        address earningToken,
        uint finalized
    ) ERC20(name, symbol) {
        _earningToken = earningToken;
        _finalized = finalized;
    }

    function burn(uint256 amount) external onlyOwner {
        _burn(msg.sender, amount);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function finalize(
        uint256 snapshotId,
        uint256 earningPerToken
    ) external onlyOwner {
        uint256 currentSnapshotId = _getCurrentSnapshotId();
        require(
            snapshotId <= currentSnapshotId && snapshotId == _finalized + 86400,
            'Mining3: invalid snapshot id'
        );
        _finalized = snapshotId;
        _earnings[snapshotId] = earningPerToken;
        IERC20(_earningToken).safeTransferFrom(
            owner(),
            address(this),
            earningPerToken * _totalSupplyAt(snapshotId)
        );
    }

    function withdraw(uint256 endSnapshotId) external whenNotPaused {
        require(
            endSnapshotId <= _finalized,
            'Mining3: snapshot not finalized yet'
        );
        Snapshots storage snapshots = _accountBalanceSnapshots[msg.sender];
        Withdrawal storage withdrawal = _withdrawals[msg.sender];
        uint256 length = snapshots.ids.length;
        require(length > 0, 'Mining3: no balance to withdraw');

        uint256 prev = withdrawal.snapshotId;
        uint256 index = withdrawal.index;
        uint256 totalEarning;
        for (; index < length; index++) {
            uint256 snapshotId = snapshots.ids[index];
            if (snapshotId < endSnapshotId) {
                totalEarning += _earning(snapshots.values[index], prev, snapshotId);
            } else {
                totalEarning += _earning(balanceOf(msg.sender), prev, endSnapshotId);
                break;
            }
            prev = snapshotId;
        }
        if (index == length) {
            totalEarning += _earning(balanceOf(msg.sender), prev, endSnapshotId);
        }
        withdrawal.snapshotId = endSnapshotId;
        withdrawal.index = index;
        IERC20(_earningToken).safeTransfer(msg.sender, totalEarning);
    }

    function _earning(
        uint256 balance,
        uint256 startSnapshotId,
        uint256 endSnapshotId
    ) private returns(uint256) {
        if (balance == 0) {
            return 0;
        }
        return 0;
    }

    function balanceOfAt(
        address account,
        uint256 snapshotId
    ) public view returns (uint256) {
        (bool snapshotted, uint256 value) = _valueAt(
            snapshotId,
            _accountBalanceSnapshots[account]
        );
        return snapshotted ? value : balanceOf(account);
    }

    function _totalSupplyAt(uint256 snapshotId) private view returns(uint) {
        uint256 length = _totalSupplySnapshots.ids.length;
        if (length == 0 || _totalSupplySnapshots.ids[length - 1] < snapshotId) {
            return totalSupply();
        }
        uint256 index = length - 1;
        while(index > 0 && _totalSupplySnapshots.ids[index - 1] >= snapshotId) {
            index--;
        }
        return _totalSupplySnapshots.values[index];
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._beforeTokenTransfer(from, to, amount);
        if (from == address(0)) {
            // mint
            _updateAccountSnapshot(to);
            _updateTotalSupplySnapshot();
        } else if (to == address(0)) {
            // burn
            _updateAccountSnapshot(from);
            _updateTotalSupplySnapshot();
        } else {
            // transfer
            _updateAccountSnapshot(from);
            _updateAccountSnapshot(to);
        }
    }

    function _getCurrentSnapshotId() internal view returns (uint256) {
        return block.timestamp - block.timestamp % 86400;
    }

    function _valueAt(
        uint256 snapshotId,
        Snapshots storage snapshots
    ) private view returns (bool, uint256) {
        require(snapshotId > 0, "ERC20Snapshot: id is 0");
        require(snapshotId <= _getCurrentSnapshotId(), "ERC20Snapshot: nonexistent id");
        uint256 index = snapshots.ids.findUpperBound(snapshotId);
        if (index == snapshots.ids.length) {
            return (false, 0);
        } else {
            return (true, snapshots.values[index]);
        }
    }

    function _updateAccountSnapshot(address account) private {
        _updateSnapshot(_accountBalanceSnapshots[account], balanceOf(account));
    }

    function _updateTotalSupplySnapshot() private {
        _updateSnapshot(_totalSupplySnapshots, totalSupply());
    }

    function _updateSnapshot(Snapshots storage snapshots, uint256 currentValue) private {
        uint256 currentId = _getCurrentSnapshotId();
        if (_lastSnapshotId(snapshots.ids) < currentId) {
            snapshots.ids.push(currentId);
            snapshots.values.push(currentValue);
        }
    }

    function _lastSnapshotId(uint256[] storage ids) private view returns (uint256) {
        return ids.length == 0 ? 0 : ids[ids.length - 1];
    }
}
