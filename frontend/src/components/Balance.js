import React from 'react';
import { ethers } from 'ethers';
import { useState, useEffect } from 'react';
import { Table, Tag } from 'antd';

const MONTH_NAME_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function toEpoch(date) {
    return Math.floor(new Date(date).getTime() / 1000);
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

function genTokenIds() {
    var startTs = toEpoch('2022-02-03T00:00:00Z');
    const endTs = startTs + 86400 * 365;
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
    const ids = genTokenIds();
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
    ];

    const fetchData = async () => {
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
          end: id.end,
          tags: id.tags.concat([id.type]),
          balance: balances[i].toString(),
        });
      }
      setDataSource(dataSource);
    }

    useEffect(() => {
      fetchData();
    }, []);

    return (
      <Table
        dataSource={dataSource}
        columns={columns}
        pagination={false}
      />
    );
}

export default Balance;

