import React from 'react';
import { ethers } from 'ethers';
import { useState } from 'react';
import Balance from '../components/Balance.js';
import Connect from '../components/Connect.js';

function HomePage() {
  const [isReady, setIsReady] = useState(false);
  const [contract, setContract] = useState(false);

  const onChange = async(chain, accounts) => {
    if (chain && accounts.length > 0) {
      const provider = new ethers.providers.Web3Provider(
        window.ethereum
      );
      var res = await fetch(`/api/v1/contract/${chain}/btc`);
      res = await res.json();
      const contract = new ethers.Contract(
          res.address, res.abi, provider
      );
      setContract(contract);
      setIsReady(true);
    } else {
      setIsReady(false);
    }
  };

  return (
    <div className="App">
      <Connect onChange={onChange}/>
      {isReady && <Balance contract={contract}/>}
    </div>
  );
}

export default HomePage;
