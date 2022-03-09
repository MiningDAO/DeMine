import React from 'react';
import { ethers } from 'ethers';
import moment from 'moment';
import BigNumber from "bignumber.js";
import { useState, useEffect } from 'react';
import { Table, Button, Modal, Divider, Spin, notification } from 'antd';

const Status = {
  NO_DATA: 'no_data',
  LOADING_DATA: 'loading_data',
  DATA_LOADED: 'data_loaded',
  CONFIRMING: 'confirming',
  WITHDRAWING: 'withdrawing',
};

function ERC20(props) {
    const [status, setStatus] = useState(Status.NO_DATA);
    const [finalizedAt, setFinalizedAt] = useState(0);
    const [dataSource, setDataSource] = useState([]);

    const columns = [
        {
            title: 'Snapshot',
            dataIndex: 'id',
            key: 'id',
            render: (value, _row) => (
                <span>{value}({new Date(value * 1000).toUTCString()})</span>
            ),
        },
        {title: 'Total Earning', dataIndex: 'earning', key: 'earning'},
        {title: 'Balance', dataIndex: 'balance', key: 'balance'},
        {title: 'Withdrawn', dataIndex: 'withdrawn', key: 'withdrawn'},
    ];

    const fetchData = async () => {
        setStatus(Status.LOADING_DATA);
        const signer = props.contract.signer;
        const withdrawAt = await props.contract.lastWithdrawAt(signer.getAddress());
        const finalizedAt = await props.contract.lastFinalizedAt();
        setFinalizedAt(finalizedAt.toNumber());

        let earningToken = await props.contract.earningToken();
        earningToken = new ethers.Contract(
            earningToken,
            ["function decimals() public view returns(uint8)"],
            signer
        );
        const decimals = await earningToken.decimals();

        const [ids, values] = await props.contract.balanceSnapshots(signer.getAddress());
        let earningSums = await props.contract.batchEarningSum(ids);
        earningSums = earningSums.map(sum => new BigNumber(sum.toString()));

        var dataSource = [];
        var totalEarning = new BigNumber(0);
        for (let i = 0; i < ids.length; i++) {
            const snapshot = ids[i].toNumber();
            const balance = new BigNumber(values[i].toString());
            const earningPerToken = earningSums[i].minus(
                i == 0 ? 0 : earningSums[i - 1]
            ).div(decimals);
            totalEarning = totalEarning.plus(earningPerToken.times(balance));
            dataSource.push({
                key: i.toString(),
                id: snapshot,
                balance: balance.toFixed(),
                earning: earningPerToken.times(balance).toFixed(),
                withdrawn: snapshot <= withdrawAt.toNumber() ? 'true' : 'false',
            });
        }
        props.onEarning(totalEarning.toFixed());
        setDataSource(dataSource);
    }

    useEffect(() => {
        fetchData().then(() => {
            setStatus(Status.DATA_LOADED);
        }).catch((err) => {
            setStatus(Status.NO_DATA);
            setDataSource([]);
            openNotification(err.toString());
        })
    }, []);

    const openNotification = (err) => {
      notification.open({
        message: 'Failed to transfer',
        description: err,
        onClick: () => {},
      });
    };

    const execWithdraw = async() => {
        setStatus(Status.WITHDRAWING);
        props.contract.withdraw().then((tx) => {
            return tx.wait(3);
        }).then((txReceipt) => {
            return fetchData();
        }).then(() => {
            setStatus(Status.DATA_LOADED);
        }).catch((err) => {
            setStatus(Status.NO_DATA);
            openNotification(err.toString());
        });
    }

    const confirmWithdraw = () => {
        setStatus(Status.CONFIRMING);
    };

    return (
      <div className='transfer'>
        <>
          {
            status === Status.WITHDRAWING
              ? <Spin tip="Waiting for 3 confirmations..." />
              : <Button
                  className='right-space'
                  type="primary"
                  onClick={confirmWithdraw}
                >
                  {'Withdraw'}
                </Button>
          }
        </>
        <Divider />
        <Table
          rowClassName={(row) => {
              let classes = [];
              if (row.withdrawn === 'true') {
                  classes.push('withdrawed');
              }
              if (status === Status.CONFIRMING) {
                  classes.push('pending-withdraw');
              }
              return classes.join(' ');
          }}
          dataSource={dataSource}
          columns={columns}
          pagination={false}
          loading={status === Status.LOADING_DATA}
        />
        <Modal
          title="Confirm to withdraw"
          visible={status === Status.CONFIRMING}
          onOk={execWithdraw}
          onCancel={() => setStatus(Status.DATA_LOADED)}
        >
        </Modal>
      </div>
    );
}

export default ERC20;
