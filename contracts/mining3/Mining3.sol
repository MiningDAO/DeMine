// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "@openzeppelin/contracts/utils/Arrays.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";
import "@openzeppelin/contracts/proxy/Proxy.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

contract Mining3Proxy is Proxy {
    event Clone(address indexed source, address indexed cloned);

    address public immutable beacon;

    constructor(address _beacon) {
        beacon = _beacon;
    }

    function clone(
        string memory name,
        string memory symbol,
        address earningToken,
        uint startSnapshotId,
        address owner
    ) external returns(address) {
        address cloned = Clones.clone(address(this));
        emit Clone(address(this), cloned);
        Mining3(cloned).initialize(
            name,
            symbol,
            earningToken,
            startSnapshotId
        );
        OwnableUpgradeable(cloned).transferOwnership(owner);
        return cloned;
    }

    function _implementation() internal view override returns (address) {
        return IBeacon(beacon).implementation();
    }
}

contract Mining3 is
    Initializable,
    ERC20Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable
{
    using Arrays for uint256[];
    using SafeERC20 for IERC20;

    struct Withdrawal {
        uint256 snapshotId;
        uint256 index;
    }

    address private _earningToken;
    uint256 private _finalized;
    mapping(address => Withdrawal) _withdrawal;
    mapping(uint256 => uint256) _earningSum;

    struct Snapshots {
        uint256[] ids;
        uint256[] values;
    }
    mapping(address => Snapshots) private _accountBalanceSnapshots;
    Snapshots private _totalSupplySnapshots;

    function initialize(
        string memory name,
        string memory symbol,
        address earningTokenToSet,
        uint startSnapshotId
    ) external initializer {
        __Ownable_init();
        __Pausable_init();
        __ERC20_init(name, symbol);
        _earningToken = earningTokenToSet;
        _finalized = startSnapshotId;
    }

    function burn(uint256 amount) external onlyOwner {
        _burn(msg.sender, amount);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function finalize(uint256 earningPerToken) external onlyOwner {
        uint256 snapshotId = _finalized + 86400;
        uint256 currentSnapshotId = _getCurrentSnapshotId();
        require(
            snapshotId <= currentSnapshotId,
            'Mining3: all snapshots finalized'
        );

        _earningSum[snapshotId] = _earningSum[snapshotId - 86400] + earningPerToken;
        _finalized = snapshotId;

        uint256 supply;
        uint256 length = _totalSupplySnapshots.ids.length;
        if (length == 0 || _totalSupplySnapshots.ids[length - 1] < snapshotId) {
            supply = totalSupply();
        } else {
            uint256 index = length - 1;
            while(index > 0 && _totalSupplySnapshots.ids[index - 1] >= snapshotId) {
                index--;
            }
            supply = _totalSupplySnapshots.values[index];
        }

        IERC20(_earningToken).safeTransferFrom(
            owner(),
            address(this),
            earningPerToken * supply
        );
    }

    function withdraw(uint256 snapshotId) external whenNotPaused {
        require(snapshotId % 86400 == 0, 'Mining3: malformed snapshot id');
        require(snapshotId <= _finalized, 'Mining3: not finalized');

        Withdrawal storage withdrawal = _withdrawal[msg.sender];
        uint256 prev = withdrawal.snapshotId;
        require(snapshotId > prev, 'Mining3: already withdrawed');

        Snapshots storage snapshots = _accountBalanceSnapshots[msg.sender];
        uint256 length = snapshots.ids.length;

        uint256 totalEarning;
        uint256 index = withdrawal.index;
        for (; index < length; index++) {
            uint256 cur = snapshots.ids[index];
            if (cur < snapshotId) {
                totalEarning += _earning(snapshots.values[index], prev, cur);
            } else {
                totalEarning += _earning(balanceOf(msg.sender), prev, snapshotId);
                break;
            }
            prev = cur;
        }
        if (index == length) {
            totalEarning += _earning(balanceOf(msg.sender), prev, snapshotId);
        }
        withdrawal.snapshotId = snapshotId;
        withdrawal.index = index;

        IERC20(_earningToken).safeTransfer(msg.sender, totalEarning);
    }

    function balanceOfAt(
        address account,
        uint256 snapshotId
    ) external view returns (uint256) {
        (bool snapshotted, uint256 value) = _valueAt(
            snapshotId,
            _accountBalanceSnapshots[account]
        );
        return snapshotted ? value : balanceOf(account);
    }

    function totalSupplyAt(uint256 snapshotId) external view returns (uint256) {
        (bool snapshotted, uint256 value) = _valueAt(
            snapshotId,
            _totalSupplySnapshots
        );
        return snapshotted ? value : totalSupply();
    }

    function lastFinalizedAt() external view returns(uint256) {
        return _finalized;
    }

    function lastWithdrawAt(address account) external view returns(uint256) {
        return _withdrawal[account].snapshotId;
    }

    function earningToken() external view returns(address) {
        return _earningToken;
    }

    function earningSum(uint256 snapshotId) public view returns(uint256) {
        return _earningSum[snapshotId];
    }

    function _earning(uint256 balance, uint256 from, uint256 to) private view returns(uint256) {
        return balance == 0 ? 0 : balance * (
            _earningSum[to] - _earningSum[from]
        );
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
