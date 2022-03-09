import React from 'react';
import { ethers } from 'ethers';
import { useState } from 'react';
import { Layout } from 'antd';
import ERC20 from '../components/ERC20.js';
import Connect from '../components/Connect.js';

const { Header, Content, Footer } = Layout;

const contractAbi = [
  "function lastWithdrawAt(address account) external view returns(uint256)",
  "function lastFinalizedAt() external view returns(uint256)",
  "function balanceSnapshots(address account) external view returns(tuple(uint256[], uint256[]))",
  "function batchEarningSum(uint256[] calldata snapshotIds) external view returns(uint256[])",
  "function earningToken() external view returns(address)",
  "function withdraw() external",
  "event Transfer(address indexed from, address indexed to, uint amount)",
];

const contractAddresses = {
    '56': {'btc': '0x'}, // bsc
    '97': {'btc': '0xFF515F62E65649D5776b063829DCc809Ab22944e'}, // bsc testnet
    '137': {'btc': '0x'}, // matic
    '80001': {'btc': '0x'}, // mumbai
};

function HomePage() {
  const [isReady, setIsReady] = useState(false);
  const [chain, setChain] = useState(false);
  const [contract, setContract] = useState(null);
  const [earning, setEarning] = useState(0);

  const onChange = async(chain, accounts) => {
    if (chain && accounts.length > 0) {
      const chainDecimals = ethers.BigNumber.from(chain).toString();
      setChain(chain);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      setContract(new ethers.Contract(
          contractAddresses[chainDecimals]['btc'], contractAbi, provider.getSigner()
      ));
      setIsReady(true);
    } else {
      setIsReady(false);
    }
  };

  return (
    <Layout className="App">
      <Header className="header">
        <Connect onChange={onChange} earning={earning}/>
      </Header>
      {
        isReady &&
        <Content styles={{ padding: '50px 50px' }}>
          <ERC20
            onEarning={(value) => setEarning(value)}
            contract={contract}
            chain={chain}
          />
        </Content>
      }
      <Footer style={{ textAlign: 'center' }}>
        Mining3 ©2022
      </Footer>
    </Layout>
  );
}

export default HomePage;
