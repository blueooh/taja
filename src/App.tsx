import React, { useState } from 'react';
import './App.css';
import TypingGame from './components/TypingGame';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>타자 게임</h1>
        <p>문장을 빠르고 정확하게 타이핑해보세요!</p>
      </header>
      <main>
        <TypingGame />
      </main>
    </div>
  );
}

export default App;
