import './App.css';
import { useState } from 'react';

import Balance from './components/Balance.js';
import Connect from './components/Connect.js';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [contract, setContract] = useState(false);

  onConnected = async() {
    // Use the MetaMask wallet as ethers provider
    const provider = new ethers.providers.Web3Provider(window.ethereum);

    // Create a JavaScript object from the Contract ABI, to interact
    // with the HelloWorld contract.
    setContract(new ethers.Contract(
      contractAddress.Contract,
      ContractArtifact.abi,
      provider.getSigner()
    ));
    setIsConnected(true);
  };

  return (
    <div className="App">
      <header className="App-header">
        <Connect onConnected=onConnected/>
        {isConnected && <Balance />}
      </header>
    </div>
  );
}

export default App;
