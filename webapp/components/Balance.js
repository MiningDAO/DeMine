import React from 'react';
import moment from 'moment';
import BigNumber from "bignumber.js";
import { ethers } from 'ethers';
import { useState, useEffect } from 'react';
import { Table, Tag, Input, InputNumber } from 'antd';
import { Checkbox, Button, Modal, Divider, DatePicker, Spin, notification } from 'antd';

const { RangePicker } = DatePicker;

const MONTH_NAME_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const calEarning = (earningMap, id, decimals) => {
  let earning = new BigNumber(0);
  for (let ts = id.startTs + 86400; ts <= id.endTs; ts += 86400) {
      earning = earning.plus(earningMap[ts] || 0);
  }
  const base = new BigNumber(10).pow(decimals);
  return earning.div(base);
}

const Status = {
  NO_DATA: 'no_data',
  LOADING_DATA: 'loading_data',
  DATA_LOADED: 'data_loaded',
  CONFIRMING: 'confirming',
  TRANSFERRING: 'transferring',
};

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
    const [status, setStatus] = useState(Status.NO_DATA);
    const [contract, setContract] = useState(null);

    const [dataSource, setDataSource] = useState([]);
    const [dataView, setDataView] = useState([]);

    const [dateRange, setDateRange] = useState([
        startOfWeek().subtract(4, 'week'),
        startOfWeek().add(1, 'y'),
    ]);

    const [tabKey, setTabKey] = useState('btc');
    const [transferAmounts, setTransferAmounts] = useState({});
    const [redeem, setRedeem] = useState(false);
    const [sendAll, setSendAll] = useState(false);
    const [recipientAddress, setRecipientAddress] = useState('');
    const [custodian, setCustodian] = useState(false);
    const [finalized, setFinalized] = useState(0);

    const columns = [
        {
            title: 'Token Id',
            dataIndex: 'id',
            key: 'id',
            render: id => (
                <a href={'/api/v1/token/bsc/' + tabKey + '/' + id.id}>{id.id}</a>
            )
        },
        {title: 'Start', dataIndex: 'start', key: 'start',},
        {title: 'End', dataIndex: 'end', key: 'end',},
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
        {
            title: 'Earning',
            dataIndex: 'earning',
            key: 'earning',
            render: (value, row) => (
                <>
                  <span>Total: {value.times(row.balance).toFixed()}</span>
                  <br/>
                  <span>Per token: {value.toFixed()}</span>
                </>
            ),
        },
        {title: 'Balance', dataIndex: 'balance', key: 'balance'},
        {
            title: 'Amount To Transfer',
            dataIndex: 'amount',
            key: 'amount',
            render: (amount, row) => (
                <>
                  <InputNumber
                    className='right-space'
                    min={0}
                    max={row.balance}
                    disabled={status === Status.TRANSFERRING || sendAll}
                    value={transferAmounts[row.id.id]}
                    defaultValue={0}
                    onChange={(value) => {
                      onTransferAmountChange(row, value);
                    }}
                  />
                  <Button
                    disabled={status === Status.TRANSFERRING || sendAll}
                    onClick={applyToAll(row)}
                  >
                    Apply To All
                  </Button>
                </>
            ),
        },
    ];

    const applyToAll = (row) => () => {
        const amount = transferAmounts[row.id.id];
        if (amount > 0) {
          setTransferAmounts(dataView.reduce(
              (p, d) => ({
                  ...p,
                  [d.id.id]: amount > d.balance ? d.balance : amount
              }),
              {}
          ));
        } else {
          openNotification("Amount must be larger than 0");
        }
    };

    const fetchData = async () => {
        setStatus(Status.LOADING_DATA);

        var contractMeta = await fetch(`/api/v1/contract/${props.chain}/${tabKey}`);
        contractMeta = await contractMeta.json();

        const contract = new ethers.Contract(
            contractMeta.address, contractMeta.abi, props.provider
        );
        setContract(contract);

        var earningMap = await fetch(`/api/v1/earning/${props.chain}/${tabKey}`);
        earningMap = await earningMap.json();

        const ids = genTokenIds(dateRange[0], dateRange[1]);
        const signer = props.provider.getSigner();
        const address = await signer.getAddress();
        const accounts = Array(ids.length).fill(address);

        setCustodian(await contract.custodian());
        const finalized = await contract.finalized();
        setFinalized(finalized.toNumber());

        const balances = await contract.balanceOfBatch(
            accounts, ids.map(id => id.raw)
        );
        var dataSource = [];
        var totalEarning = new BigNumber(0);
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i];
          const balance = balances[i].toNumber();
          const earingPerToken = calEarning(
            earningMap.earning, id, contractMeta.earningToken.decimals
          );
          totalEarning = totalEarning.plus(earingPerToken.times(balance));
          dataSource.push({
            key: i.toString(),
            id: id,
            start: id.start,
            end: id.end,
            tags: id.tags.concat([id.type]),
            balance: balance,
            earning: earingPerToken,
          });
        }
        props.onEarning(totalEarning.toFixed());
        setDataSource(dataSource);
        setDataView(dataSource);
    }

    const onTransferAmountChange = (row, value) => {
        setTransferAmounts({
            ...transferAmounts,
            [row.id.id]: value,
        });
    }

    const onDateChange = (_dates, datesString) => {
        setDateRange(datesString);
    }

    useEffect(() => {
        fetchData().then(() => {
            setStatus(Status.DATA_LOADED);
        }).catch((err) => {
            setStatus(Status.NO_DATA);
            setDataSource([]);
            setDataView([]);
            openNotification(err.toString());
        })
    }, [dateRange]);

    const openNotification = (err) => {
      notification.open({
        message: 'Failed to transfer',
        description: err,
        onClick: () => {},
      });
    };

    const execTransfer = async() => {
        setStatus(Status.TRANSFERRING);
        let recipient;
        try {
          recipient = redeem
              ? custodian
              : ethers.utils.getAddress(recipientAddress);
        } catch(err) {
          openNotification(err.toString());
          return;
        }

        const signer = props.provider.getSigner();
        const sender = await signer.getAddress();
        const ids = Object.keys(transferAmounts).filter(
            id => transferAmounts[id] > 0
        );
        const encoded = ids.map(id => ethers.BigNumber.from(id));
        const amounts = ids.map(
            id => ethers.BigNumber.from(transferAmounts[id])
        );
        contract.connect(signer).safeBatchTransferFrom(
            sender, recipient, encoded, amounts, []
        ).then((tx) => {
            return tx.wait(3);
        }).then((txReceipt) => {
            setStatus(Status.DATA_LOADED);
            setTransferAmounts(ids.reduce(
                (prev, cur) => ({[cur]: 0, ...prev}),
                {}
            ));
            return fetchData();
        }).then(() => {
            setStatus(Status.DATA_LOADED);
        }).catch((err) => {
            setStatus(Status.NO_DATA);
            openNotification(err.toString());
        });
    }

    const confirmTransfer = () => {
        const keys = Object.keys(
            transferAmounts
        ).filter(k => transferAmounts[k] > 0);
        if (keys.length === 0) {
          openNotification("You have to specify at least one token to transfer");
          return;
        }
        setTransferAmounts(keys.reduce(
            (p, k) => ({...p, [k]: transferAmounts[k]}),
            {}
        ));
        setStatus(Status.CONFIRMING);
    };

    const onSendAll = (checked) => {
        setSendAll(checked);
        if (checked) {
            setTransferAmounts(dataView.reduce(
                (p, d) => ({...p, [d.id.id]: d.balance}),
                {}
            ));
        }
    };

    const onTabKey = (key) => {
        setTabKey(key);
    };

    const enableRedeem = (value) => {
        setRedeem(value);
        if (value) {
            const filtered = dataSource.filter(d => d.id.endTs <= finalized);
            setDataView(filtered);
            setTransferAmounts(filtered.reduce(
                (p, d) => ({...p, [d.id.id]: transferAmounts[d.id.id]}),
                {}
            ));
        } else {
            setDataView(dataSource);
            setTransferAmounts(transferAmounts);
        }
    };

    return (
      <div className='transfer'>
        <>
          {
            status === Status.TRANSFERRING
              ? <Spin tip="Waiting for 3 confirmations..." />
              : <>
                <Input
                  className='right-space'
                  addonBefore="Recipient Address"
                  placeholder="0x..."
                  disabled={redeem || status === Status.NO_DATA}
                  value={redeem ? custodian : recipientAddress}
                  allowClear
                  onChange={
                      (e) => setRecipientAddress(e.target.value)
                  }
                  style={{ width: 800 }}
                />
                <Button
                  className='right-space'
                  type="primary"
                  onClick={confirmTransfer}
                >
                  {redeem ? 'Redeem' : 'Transfer'}
                </Button>
                <Checkbox
                  disabled={custodian === null}
                  onChange={(e) => enableRedeem(e.target.checked)}>
                  Redeem
                </Checkbox>
                <Checkbox
                  onChange={(e) => onSendAll(e.target.checked)}>
                  Send All
                </Checkbox>
                </>
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
              if (row.id.startTs <= finalized && row.id.endTs > finalized) {
                  classes.push('finalizing');
              }
              if (row.id.endTs <= finalized) {
                  classes.push('finalized');
              }
              if (transferAmounts[row.id.id] > 0 && status === Status.CONFIRMING) {
                  classes.push('pending-transfer');
              }
              return classes.join(' ');
          }}
          dataSource={dataView}
          columns={columns}
          pagination={false}
          loading={status === Status.LOADING_DATA}
        />
        <Modal
          title="Confirm to transfer"
          visible={status === Status.CONFIRMING}
          onOk={execTransfer}
          onCancel={() => setStatus(Status.DATA_LOADED)}
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
