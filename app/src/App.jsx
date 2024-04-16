import React, { useEffect, useState } from 'react';
import './styles/App.css';
import g from './assets/g.png'
import { Header } from './components/header.jsx'
import { Login } from './components/login.jsx'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false); // Initialize isLoggedIn state

  // Function to set isLoggedIn state to true
  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  let content;
  if (isLoggedIn) {
    content = <Header />;
  } else {
    content = <Login onLogin={handleLogin}/>;
  }

  return (
    <>
      {content}
      <img src={g} alt="g.png" className='g' />
    </>
  );
}

export default App;
