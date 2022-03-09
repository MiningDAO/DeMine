import React from 'react';
import { useEffect, useState } from 'react';
import MetaMaskOnboarding from '@metamask/onboarding';
import { Spin, Button, PageHeader } from 'antd';

const BSC_MAINNET_PARAMS = {
  chainId: '0x38',
  chainName: 'Binance Smart Chain Mainnet',
  nativeCurrency: {
    name: 'Binance Coin',
    symbol: 'BNB',
    decimals: 18
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
    decimals: 18
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

function Connect(props) {
  const [accounts, setAccounts] = useState([]);
  const [chainId, setChainId] = useState(null);
  const [onboarding, setOnboarding] = useState(null);
  const [installed, setInstalled] = useState(false);

  const onChange = (from, chainId, accounts) => {
    if (isBSC(chainId)) {
      props.onChange(chainId, accounts);
    } else if (isBSCTest(chainId)) {
      props.onChange(chainId, accounts);
    } else {
      props.onChange(null, []);
    }
  };

  const connectMetaMask = () => {
    window.ethereum
      .request({ method: 'eth_requestAccounts' })
      .then(accs => {
          setAccounts(accs);
          window.ethereum
            .request({
              method: 'eth_chainId',
              params: []
            }).then(
              chainId => {
                setChainId(chainId);
                onChange('init', chainId, accs);
              }
            );
      });
  }

  const switchToBSC = () => {
    window.ethereum
      .request({
        method: 'wallet_addEthereumChain',
        params: [BSC_MAINNET_PARAMS]
      }).then(() => {
        setChainId(BSC_MAINNET_PARAMS.chainId);
        onChange('switch', BSC_MAINNET_PARAMS.chainId, accounts);
      });
  }

  useEffect(() => {
    const installed = MetaMaskOnboarding.isMetaMaskInstalled();
    const onboarding = new MetaMaskOnboarding();
    setOnboarding(onboarding);
    setInstalled(installed);

    if (installed) {
      window.ethereum.on(
        'accountsChanged',
        accounts => {
          setAccounts(accounts);
          onChange('accountsChanged', chainId, accounts);
        }
      );

      window.ethereum.on(
        'chainChanged',
        (chainId) => {
           setChainId(chainId);
           onChange('chainChanged', chainId, accounts);
        }
      );

      window.ethereum.on(
        'disconnect',
        (connectInfo) => { window.location.reload(); }
      );

      window.ethereum.on('connect', (connectInfo) => {
        setChainId(connectInfo.chainId);
        onChange('connect', connectInfo.chainId, accounts);
      });
    }

    if (installed && accounts.length > 0) {
      onboarding.stopOnboarding();
    }

    if (installed && accounts.length == 0) {
      connectMetaMask();
    }
  }, [chainId]);

  if (!installed) {
    return (
      <div>
        <div>To run this dApp you need the MetaMask Wallet installed.</div>
        <Button type="primary" onClick={onboarding && onboarding.startOnboarding}>
            Install MetaMask
        </Button>
      </div>
    );
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
    return (
      <PageHeader
        className="site-page-header"
        title="Mining3"
        subTitle="Mining for Web3"
        extra={[
            <div key="1">
              <span> Account: {accounts[0]} </span>
              <br/>
              <span> Aggregated Earning: {props.earning} </span>
            </div>
        ]}
      />
    );
  }
}

export default Connect;
