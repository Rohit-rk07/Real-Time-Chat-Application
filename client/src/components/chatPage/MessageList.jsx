import React from "react";
import ReactScrollToBottom from "react-scroll-to-bottom";

const MessageList = ({ messages }) => {
  return (
    <ReactScrollToBottom className="chatBox">
      {messages.map((item, index) => (
        <div 
          key={index} 
          className={`messageContainer ${item.isMine ? "right" : "left"}`}
        >
          {!item.isMine && (
            <div className="messageUser">{item.user} ({item.uid})</div>
          )}
          <div className={`message ${item.isMine ? "sent" : "received"}`}>
            {item.message}
          </div>
          {item.timestamp && (
            <div className="messageTime">
              {new Date(item.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
              })}
            </div>
          )}
        </div>
      ))}
    </ReactScrollToBottom>
  );
};

export default MessageList;