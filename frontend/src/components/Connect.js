import React from 'react';
import { useEffect, useState } from 'react';
import MetaMaskOnboarding from '@metamask/onboarding';
import { Button } from 'antd';
import { PageHeader } from 'antd';

import '../App.css';

const BSC_MAINNET_PARAMS = {
  chainId: '0x38',
  chainName: 'Binance Smart Chain Mainnet',
  nativeCurrency: {
    name: 'Binance Coin',
    symbol: 'BNB',
    decimals: 8
  },
  rpcUrls: ['https://bsc-dataseed.binance.org'],
  blockExplorerUrls: ['https://bscscan.com']
};

const BSC_TESTNET_PARAMS = {
  chainId: '0x61',
  chainName: 'Binance Smart Chain TestNet',
  nativeCurrency: {
    name: 'Test Binance Coin',
    symbol: 'TBNB',
    decimals: 8
  },
  rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545'],
  blockExplorerUrls: ['https://testnet.bscscan.com']

};

const isBSC = (chainId) => (
  chainId && BSC_MAINNET_PARAMS.chainId.toLowerCase() === chainId
);

const isBSCTest = (chainId) => (
  chainId && BSC_TESTNET_PARAMS.chainId.toLowerCase() === chainId
);

function Connect({ onConnected }) {
  const [accounts, setAccounts] = useState([]);
  const [chainId, setChainId] = useState(null);
  const onboarding = new MetaMaskOnboarding();

  const connectMetaMask = () => {
    window.ethereum
      .request({ method: 'eth_requestAccounts' })
      .then(accounts => setAccounts(accounts));
  }

  const switchToBSC = () => {
    // Request to switch to the selected Avalanche network
    window.ethereum
      .request({
        method: 'wallet_addEthereumChain',
        params: [BSC_MAINNET_PARAMS]
      })
  }

  useEffect(() => {
    connectMetaMask();
    if (MetaMaskOnboarding.isMetaMaskInstalled()) {
      window.ethereum.on(
        'accountsChanged',
        accounts => {
          window.location.reload();
        }
      );

      window.ethereum.on(
        'chainChanged',
        () => window.location.reload()
      );

      window.ethereum.on(
        'disconnect',
        (connectInfo) => {
          window.location.reload();
        }
      );

      window.ethereum.on('connect', (connectInfo) => {
        setChainId(connectInfo.chainId);
        if (isBSC(connectInfo.chainId)) {
          onConnected("bsc");
        } else if (isBSCTest(connectInfo.chainId)) {
          onConnected("bscdev");
        }
      });
    }
  }, []);

  if (MetaMaskOnboarding.isMetaMaskInstalled() && accounts.length > 0) {
    onboarding.stopOnboarding();
  }

  if (!MetaMaskOnboarding.isMetaMaskInstalled()) {
    return (
      <div>
        <div>To run this dApp you need the MetaMask Wallet installed.</div>
        <Button type="primary" onClick={onboarding.startOnboarding}>
          Install MetaMask
        </Button>
      </div>
    )
  } else if (accounts.length === 0) {
    return (
      <div>
        <div>To run this dApp you need to connect your MetaMask Wallet.</div>
        <Button type="primary" onClick={connectMetaMask}>
          Connect your Wallet
        </Button>
      </div>
    )
  } else if (!isBSC(chainId) && !isBSCTest(chainId)) {
    return (
      <div>
        <div>MetaMask Wallet connected!</div>
        <div>Chain: {chainId}</div>
        <div>Account: {accounts[0]}</div>
        <div>To run this dApp you need to switch to the {BSC_MAINNET_PARAMS.chainName} chain</div>
        <Button type="primary" onClick={switchToBSC}>
          Switch to the {BSC_MAINNET_PARAMS.chainName} chain
        </Button>
      </div>
    )
  } else {
    // The user is connected to the MetaMask wallet and has the Avalanche chain selected.
    return (
      <PageHeader
        className="site-page-header"
        title="Mining3"
        subTitle="Mining for Web3"
        extra={[
            <div key="1">Account: {accounts[0]}</div>
        ]}
      />
    );
  }
}

export default Connect;
