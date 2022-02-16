import React from 'react';
import moment from 'moment';
import { ethers } from 'ethers';
import { useState, useEffect } from 'react';
import { Table, Tag, Input, InputNumber } from 'antd';
import { Modal, Divider, DatePicker, Spin, notification } from 'antd';

const { RangePicker } = DatePicker;
const { Search } = Input;

const MONTH_NAME_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function toEpoch(date) {
    return Math.floor(new Date(date).getTime() / 1000);
}

function startOfWeek() {
    const epoch = moment().unix();
    return moment.unix(epoch - epoch % (86400 * 7));
}

function genTokenId(startTs, endTs, type) {
    const id = ethers.BigNumber.from(startTs).shl(128).add(endTs);

    const startDate = new Date(startTs * 1000);
    const startYear = startDate.getFullYear().toString();
    const startMonth = MONTH_NAME_SHORT[startDate.getMonth()];
    let tags = [startYear, startMonth];

    const endDate = new Date(endTs * 1000);
    const endYear = endDate.getFullYear().toString();
    const endMonth = MONTH_NAME_SHORT[endDate.getMonth()];
    if (!tags.includes(endYear)) {
        tags.push(endYear);
    }
    if (!tags.includes(endMonth)) {
        tags.push(endMonth);
    }

    return {
        startTs,
        endTs,
        start: new Date(startTs * 1000).toISOString(),
        end: new Date(endTs * 1000).toISOString(),
        type: type,
        id: id.toString(),
        hex: id.toHexString(),
        tags: tags,
        raw: id,
    };
}

function genTokenIds(startDate, endDate) {
    var startTs = toEpoch(startDate);
    const endTs = toEpoch(endDate);
    var tokenIds = [];
    for (;startTs < endTs;) {
        const tokenId = genTokenId(startTs, startTs + 86400 * 7, 'weekly');
        if (tokenId.endTs <= endTs) {
            tokenIds.push(tokenId);
        }
        startTs = tokenId.endTs;
    }
    return tokenIds;
}

function Balance(props) {
    const [dataSource, setDataSource] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [dateRange, setDateRange] = useState([
        startOfWeek().subtract(4, 'week'),
        startOfWeek().add(1, 'y'),
    ]);
    const [transferAmounts, setTransferAmounts] = useState({});
    const [recipient, setRecipient] = useState(null);
    const [transferring, setTransferring] = useState(false);
    const [pendingConfirm, setPendingConfirm] = useState(false);

    const columns = [
        {
            title: 'Token Id',
            dataIndex: 'id',
            key: 'id',
            render: id => (
                <a href={'https://api.hypertrons.com/api/v1/token/bsc/btc/' + id}>{id}</a>
            )
        },
        {title: 'Start', dataIndex: 'start', key: 'start'},
        {title: 'End', dataIndex: 'end', key: 'end'},
        {
            title: 'Tags',
            dataIndex: 'tags',
            key: 'tags',
            render: tags => (
              <>
                {tags.map(tag => {
                  let color = 'green';
                  if (tag === 'daily') {
                    color = 'volcano';
                  }
                  if (tag === 'weekly') {
                    color = 'geekblue';
                  }
                  return (
                    <Tag color={color} key={tag}>
                      {tag.toUpperCase()}
                    </Tag>
                  );
                })}
              </>
            ),
        },
        {title: 'Balance', dataIndex: 'balance', key: 'balance'},
        {
            title: 'Amount To Transfer',
            dataIndex: 'amount',
            key: 'amount',
            render: (amount, row) => (
                <InputNumber
                  min={0}
                  max={row.balance}
                  disabled={transferring}
                  defaultValue={0}
                  onChange={(value) => {
                    onTransferAmountChange(row, value);
                  }}
                />
            ),
        },
    ];

    const fetchData = async () => {
      setDataLoading(true);
      const ids = genTokenIds(dateRange[0], dateRange[1]);
      const signer = props.contract.provider.getSigner();
      const address = await signer.getAddress();
      const accounts = Array(ids.length).fill(address);
      const balances = await props.contract.balanceOfBatch(
          accounts, ids.map(id => id.raw)
      );
      var dataSource = [];
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        dataSource.push({
          key: i.toString(),
          id: id.id,
          start: id.start,
          startTs: id.startTs,
          endTs: id.endTs,
          end: id.end,
          tags: id.tags.concat([id.type]),
          balance: balances[i].toNumber(),
          amount: 0
        });
      }
      setDataSource(dataSource);
      setDataLoading(false);
    }

    const onTransferAmountChange = (row, value) => {
        transferAmounts[row.id] = value;
        setTransferAmounts(transferAmounts);
    }

    const onDateChange = (_dates, datesString) => {
        setDateRange(datesString);
    }

    useEffect(() => { fetchData(); }, [dateRange]);

    const openNotification = (err) => {
      notification.open({
        message: 'Failed to transfer',
        description: err,
        onClick: () => {},
      });
    };

    const execTransfer = async() => {
        setPendingConfirm(false);
        setTransferring(true);
        const signer = props.contract.provider.getSigner();
        const sender = await signer.getAddress();
        const ids = Object.keys(transferAmounts).filter(
            id => transferAmounts[id] > 0
        );
        const encoded = ids.map(id => ethers.BigNumber.from(id));
        const amounts = ids.map(
            id => ethers.BigNumber.from(transferAmounts[id])
        );
        props.contract.connect(signer).safeBatchTransferFrom(
            sender, recipient, encoded, amounts, []
        ).then((tx) => {
            return tx.wait(3);
        }).then((txReceipt) => {
            setTransferring(false);
            const newAmounts = {};
            setTransferAmounts(ids.reduce(
                (prev, cur) => ({[cur]: 0, ...prev}),
                {}
            ));
            fetchData();
        }).catch((err) => {
            setTransferring(false);
            openNotification(err.toString());
        });
    }

    const confirmTransfer = (recipientAddress) => {
        if (Object.keys(transferAmounts).length == 0) {
          openNotification("You have to specify at least one token to transfer");
          return;
        }

        try {
          setRecipient(ethers.utils.getAddress(recipientAddress));
          setPendingConfirm(true);
        } catch(err) {
          openNotification(err.toString());
          return;
        }
    }

    const cancelTransfer = () => {
        setPendingConfirm(false);
        setRecipient(null);
    }

    return (
      <div className='transfer'>
        <>
          {
            transferring
              ? <Spin tip="Will wait for 3 confirmations..." />
              : <Search
                  addonBefore="Recipient Address"
                  placeholder="0x..."
                  allowClear
                  enterButton="Transfer"
                  onSearch={
                      (recipientAddress, e) => confirmTransfer(recipientAddress)
                  }
                  style={{ width: 800 }}
                />
          }
        </>
        <Divider />
        <RangePicker
          defaultValue={dateRange}
          format={'YYYY-MM-DDT00:00:00[Z]'}
          onChange={onDateChange}
        />
        <Table
          rowClassName={(row) => {
              let classes = [];
              let now = moment().unix();
              if (row.startTs <= now && row.endTs > now) {
                  classes.push('finalizing');
              }
              if (row.endTs <= now) {
                  classes.push('finalized');
              }
              if (transferAmounts[row.id] > 0 && pendingConfirm) {
                  classes.push('pending-transfer');
              }
              return classes.join(' ');
          }}
          dataSource={dataSource}
          columns={columns}
          pagination={false}
          loading={dataLoading}
        />
        <Modal
          title="Confirm to transfer"
          visible={pendingConfirm}
          onOk={execTransfer}
          onCancel={cancelTransfer}
        >
          {
            Object.keys(transferAmounts).filter(
              id => transferAmounts[id] > 0
            ).map(id => {
              return (
                  <p key={id}>{id}, {transferAmounts[id]}</p>
              )
            })
          }
        </Modal>
      </div>
    );
}

export default Balance;
