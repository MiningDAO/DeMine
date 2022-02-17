import React from 'react';
import { ethers } from 'ethers';
import { useState } from 'react';
import { Layout } from 'antd';
import Balance from '../components/Balance.js';
import Connect from '../components/Connect.js';

const { Header, Content, Footer } = Layout;

function HomePage() {
  const [isReady, setIsReady] = useState(false);
  const [provider, setProvider] = useState(false);
  const [chain, setChain] = useState(false);
  const [earning, setEarning] = useState(0);

  const onChange = async(chain, accounts) => {
    if (chain && accounts.length > 0) {
      setProvider(
        new ethers.providers.Web3Provider(window.ethereum)
      );
      setChain(chain);
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
          <Balance
            onEarning={(value) => setEarning(value)}
            provider={provider}
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
