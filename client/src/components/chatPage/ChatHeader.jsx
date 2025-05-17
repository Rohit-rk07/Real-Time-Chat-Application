import React from "react";

const ChatHeader = ({ onToggleSidebar, onLogout }) => {
  return (
    <div className="header">
      <button 
        className="sidebarToggle"
        onClick={onToggleSidebar}
      >
        ≡
      </button>
      <h2>Let's Chat</h2>
      <button className="logoutButton" onClick={onLogout}>
        Logout
      </button>
    </div>
  );
};

export default ChatHeader;