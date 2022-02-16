import React from 'react';
import moment from 'moment';
import { ethers } from 'ethers';
import { useState, useEffect } from 'react';
import { Table, Tag, Input, InputNumber } from 'antd';
import { Divider, DatePicker, Space } from 'antd';

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
    const [transferAmounts, setTransferAmounts] = useState({});
    const [recipientAddress, setRecipientAddress] = useState({});
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
            title: 'Amount',
            dataIndex: 'amount',
            key: 'amount',
            render: (amount, row) => (
              <InputNumber
                min={0}
                max={row.balance}
                defaultValue={0}
                onChange={(value) => {
                  value && onTransferAmountChange(row, value);
                }}
              />
            )
        },
    ];

    const getSignerAddress = async () => {
      const signer = props.contract.provider.getSigner();
      return await signer.getAddress();
    };

    const fetchData = async (startDate, endDate) => {
      const ids = genTokenIds(startDate, endDate);
      const address = await getSignerAddress();
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
          end: id.end,
          tags: id.tags.concat([id.type]),
          balance: balances[i].toNumber(),
          amount: 0
        });
      }
      setDataSource(dataSource);
    }

    const onTransferAmountChange = (row, value) => {
        transferAmounts[row.id] = value;
        setTransferAmounts(transferAmounts);
    }

    const onDateChange = (_dates, datesString) => {
        fetchData(datesString[0], datesString[1]);
    }

    const defaultStart = startOfWeek();
    const defaultEnd = startOfWeek().add(1, 'y');

    useEffect(() => {
      fetchData(defaultStart, defaultEnd);
    }, []);

    const transfer = async(address) => {
        const sender = await getSignerAddress();
        const recipient = ethers.getAddress(address);
        const ids = Object.keys(transferAmounts).filter(
            id => transferAmounts[id] > 0
        );
        const encoded = ids.map(id => ethers.BigNumber.from(id));
        const amounts = ids.map(id => transferAmounts[ids]);
        props.contract.safeTransferFrom(sender, recipient, encoded, amounts, []);
    }

    return (
      <div>
        <Search
          addonBefore="Recipient Address"
          placeholder="0x..."
          allowClear
          enterButton="Transfer"
          onSearch={(recipient, e) => transfer(recipient)}
          style={{ width: 800 }}
        />
        <Divider />
        <RangePicker
          defaultValue={[defaultStart, defaultEnd]}
          format={'YYYY-MM-DDT00:00:00[Z]'}
          onChange={onDateChange}
        />
        <Table
          dataSource={dataSource}
          columns={columns}
          pagination={false}
        />
      </div>
    );
}

export default Balance;
