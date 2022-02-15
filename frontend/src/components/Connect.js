import { useEffect, useState } from 'react';
import { ethers } from "ethers";
import MetaMaskOnboarding from '@metamask/onboarding';

import './App.css';
import logo from './logo.svg';

import { Button } from 'antd';

const BSC_MAINNET_PARAMS = {
  chainId: '0x38',
  chainName: 'Binance Smart Chain Mainnet',
  nativeCurrency: {
    name: 'Binance Coin',
    symbol: 'BNB',
    decimals: 8
  },
  rpcUrls: ['https://bsc-dataseed.binance.org/'],
  blockExplorerUrls: ['https://bscscan.com']
}

const isBSC = (chainId) => (
  chainId && BSC_MAINNET_PARAMS.chainId.toLowerCase() === chainId
);

function Connect(props) {
  const [accounts, setAccounts] = useState([]);
  const [chainId, setChainId] = useState(null); // default bsc
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
    if (MetaMaskOnboarding.isMetaMaskInstalled()) {
      connectMetaMask()

      // Update the list of accounts if the user switches accounts in MetaMask
      window.ethereum.on('accountsChanged', accounts => this.setState({ accounts }))

      // Reload the site if the user selects a different chain
      window.ethereum.on('chainChanged', () => window.location.reload())

      // Set the chain id once the MetaMask wallet is connected
      window.ethereum.on('connect', (connectInfo) => {
        const chainId = connectInfo.chainId;
        setChainId(chainId);
        if (isBSC(chainId)) {
          // The user is now connected to the MetaMask wallet and has the correct
          // Avalanche chain selected.
          props.onConnected()
        }
      });
    }
  });

  if (MetaMaskOnboarding.isMetaMaskInstalled() && accounts.length > 0) {
    onboarding.stopOnboarding()
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
  } else if (this.state.accounts.length === 0) {
    return (
      <div>
        <div>To run this dApp you need to connect your MetaMask Wallet.</div>
        <Button type="primary" onClick={connectMetaMask}>
          Connect your Wallet
        </Button>
      </div>
    )
  } else if (!isBSC(chainId)) {
    return (
      <div>
        <div>MetaMask Wallet connected!</div>
        <div>Chain: {this.state.chainId}</div>
        <div>Account: {this.state.accounts[0]}</div>
        <div>To run this dApp you need to switch to the {BSC_MAINNET_PARAMS.chainName} chain</div>
        <Button type="primary" onClick={switchBSC}>
          Switch to the {BSC_MAINNET_PARAMS.chainName} chain
        </Button>
      </div>
    )
  } else {
    // The user is connected to the MetaMask wallet and has the Avalanche chain selected.
    return <div>
      <div>MetaMask Wallet connected!</div>
      <div>Chain: {this.state.chainId}</div>
      <div>Account: {this.state.accounts[0]}</div>
    </div>
  }
}

export default Connect;
