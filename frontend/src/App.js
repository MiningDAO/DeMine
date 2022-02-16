import './App.css';
import React from 'react';
import { ethers } from 'ethers';
import { useState } from 'react';
import Balance from './components/Balance.js';
import Connect from './components/Connect.js';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [contract, setContract] = useState(false);

  const onConnected = async(chain) => {
    const provider = new ethers.providers.Web3Provider(
      window.ethereum
    );
    var res = await fetch(
        `https://api.hypertrons.com/api/v1/contract/${bscdev}/btc`
    )
    res = await res.json();
    const contract = new ethers.Contract(
        res.address, res.abi, provider
    );
    setContract(contract);
    setIsConnected(true);
  };

  return (
    <div className="App">
      <Connect onConnected={onConnected}/>
      {isConnected && <Balance contract={contract}/>}
    </div>
  );
}

export default App;
