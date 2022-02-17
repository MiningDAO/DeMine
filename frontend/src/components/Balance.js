import React from 'react';
import moment from 'moment';
import { ethers } from 'ethers';
import { useState, useEffect } from 'react';
import { Table, Tag, Input, InputNumber } from 'antd';
import { Checkbox, Button, Modal, Divider, DatePicker, Spin, notification } from 'antd';

const { RangePicker } = DatePicker;

const MONTH_NAME_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

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

    const [dataSource, setDataSource] = useState([]);
    const [dateRange, setDateRange] = useState([
        startOfWeek().subtract(4, 'week'),
        startOfWeek().add(1, 'y'),
    ]);

    const [transferAmounts, setTransferAmounts] = useState({});
    const [enableCustodian, setEnableCustodian] = useState(false);
    const [recipientAddress, setRecipientAddress] = useState('');
    const [custodian, setCustodian] = useState(null);
    const [finalized, setFinalized] = useState(0);

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
                  disabled={status === Status.TRANSFERRING}
                  value={transferAmounts[row.id]}
                  defaultValue={0}
                  onChange={(value) => {
                    onTransferAmountChange(row, value);
                  }}
                />
            ),
        },
    ];

    const fetchData = async () => {
      setStatus(Status.LOADING_DATA);
      const ids = genTokenIds(dateRange[0], dateRange[1]);
      const signer = props.contract.provider.getSigner();
      const address = await signer.getAddress();
      const accounts = Array(ids.length).fill(address);

      const custodian = await props.contract.custodian();
      const finalized = await props.contract.finalized();
      setCustodian(ethers.utils.getAddress(custodian));
      setFinalized(finalized.toNumber());

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
      return dataSource;
    }

    const onTransferAmountChange = (row, value) => {
        setTransferAmounts({
            ...transferAmounts,
            [row.id]: value,
        });
    }

    const onDateChange = (_dates, datesString) => {
        setDateRange(datesString);
    }

    useEffect(() => {
        fetchData().then((dataSource) => {
            setStatus(Status.DATA_LOADED);
            setDataSource(dataSource);
        }).catch((err) => {
            setStatus(Status.NO_DATA);
            setDataSource([]);
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
          recipient = enableCustodian
              ? custodian
              : ethers.utils.getAddress(recipientAddress);
        } catch(err) {
          openNotification(err.toString());
          return;
        }

        console.log(recipient);

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
            setStatus(Status.DATA_LOADED);
            setTransferAmounts(ids.reduce(
                (prev, cur) => ({[cur]: 0, ...prev}),
                {}
            ));
            return fetchData();
        }).then((dataSource) => {
            setDataSource(dataSource);
            setStatus(Status.DATA_LOADED);
        }).catch((err) => {
            setStatus(Status.NO_DATA);
            openNotification(err.toString());
        });
    }

    const confirmTransfer = () => {
        if (Object.keys(transferAmounts).length === 0) {
          openNotification("You have to specify at least one token to transfer");
          return;
        }
        setStatus(Status.CONFIRMING);
    };

    const cancelTransfer = () => {
        setStatus(Status.DATA_LOADED);
    };

    const updateRecipientAddress = (address) => {
        setRecipientAddress(address);
    }

    const onSetEnableCustodian = (checked) => {
        if (custodian && checked) {
          setEnableCustodian(true);
        } else {
          openNotification('Custodian not set');
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
                  className='transfer-item'
                  addonBefore="Recipient Address"
                  placeholder="0x..."
                  disabled={enableCustodian || status === Status.NO_DATA}
                  value={enableCustodian ? custodian : recipientAddress}
                  allowClear
                  onChange={
                      (e) => updateRecipientAddress(e.target.value)
                  }
                  style={{ width: 800 }}
                />
                <Button
                  className='transfer-item'
                  type="primary"
                  onClick={confirmTransfer}
                >
                  Transfer
                </Button>
                <Checkbox onChange={onSetEnableCustodian}>
                  Send to custodian
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
              if (row.startTs <= finalized && row.endTs > finalized) {
                  classes.push('finalizing');
              }
              if (row.endTs <= finalized) {
                  classes.push('finalized');
              }
              if (transferAmounts[row.id] > 0 && status === Status.CONFIRMING) {
                  classes.push('pending-transfer');
              }
              return classes.join(' ');
          }}
          dataSource={dataSource}
          columns={columns}
          pagination={false}
          loading={status === Status.LOADING_DATA}
        />
        <Modal
          title="Confirm to transfer"
          visible={status === Status.CONFIRMING}
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
