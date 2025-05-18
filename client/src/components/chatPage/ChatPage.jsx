import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import axios from "axios";

// Components
import UserSidebar from "./UserSidebar";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";

// Server URL - replace with your actual backend URL
const SERVER_URL = "http://localhost:8000";

// Socket.io connection
let socket;

const ChatPage = () => {
  // State variables
  const [socketId, setSocketId] = useState("");
  const [messages, setMessages] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const navigate = useNavigate();

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem("chatAppUser");
    if (socket) socket.disconnect();
    navigate("/");
  };

  // Send message function
  const sendMessage = (messageText) => {
    if (messageText.trim() && socket) {
      socket.emit("message", { 
        message: messageText, 
        id: socketId, 
        user: currentUser?.name,
        uid: currentUser?.id
      });
    }
  };

  // Toggle sidebar function
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Fetch chat history
  const fetchChatHistory = async () => {
    try {
      const userData = JSON.parse(localStorage.getItem("chatAppUser"));
      if (!userData || !userData.token) return;
      
      const response = await axios.get(`${SERVER_URL}/messages`, {
        headers: { Authorization: `Bearer ${userData.token}` }
      });
      
      // Format messages for display with UID
      const formattedMessages = response.data.map(msg => ({
        id: msg._id,
        user: msg.sender.name,
        message: msg.content,
        timestamp: new Date(msg.timestamp),
        isMine: msg.sender._id === userData.id,
        uid: msg.sender._id  // Add UID to message object
      }));
      
      setMessages(formattedMessages.reverse());
    } catch (error) {
      console.error("Error fetching chat history:", error);
      setError("Failed to load chat history");
    }
  };

  // Fetch all users
  const fetchUsers = async () => {
    try {
      const userData = JSON.parse(localStorage.getItem("chatAppUser"));
      if (!userData || !userData.token) return;
      
      const response = await axios.get(`${SERVER_URL}/users`, {
        headers: { Authorization: `Bearer ${userData.token}` }
      });
      
      setUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  // Initialize socket connection and set up event listeners
  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem("chatAppUser");
    if (!userData) {
      navigate("/");
      return;
    }

    const user = JSON.parse(userData);
    setCurrentUser(user);

    // Fetch initial data
    fetchChatHistory();
    fetchUsers();

    // Connect to socket
    socket = io(SERVER_URL, {
      transports: ["websocket"],
      auth: {
        token: user.token
      }
    });

    socket.on("connect", () => {
      setSocketId(socket.id);
      console.log("Connected to socket server");
      
      // Join the chat room
      socket.emit("joined", { user: user.name, userId: user.id });
    });

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      if (error.message === "Authentication error") {
        localStorage.removeItem("chatAppUser");
        navigate("/");
      }
    });

    // Event listeners for messages
    socket.on("welcome", (data) => {
      setMessages(prev => [...prev, {
        ...data,
        uid: data.uid || data.userId  // Ensure UID is included
      }]);
    });

    socket.on("userJoined", (data) => {
      setMessages(prev => [...prev, {
        ...data,
        uid: data.uid || data.userId  // Ensure UID is included
      }]);
    });

    socket.on("leave", (data) => {
      setMessages(prev => [...prev, {
        ...data,
        uid: data.uid || data.userId  // Ensure UID is included
      }]);
    });

    socket.on("userList", (userList) => {
      // Update online status of users
      setUsers(prev => {
        if (!prev.length) return prev;
        
        return prev.map(user => ({
          ...user,
          online: userList.some(onlineUser => 
            onlineUser.userId === user.id || onlineUser.userId === user._id
          )
        }));
      });
    });

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.emit("disconnect");
        socket.off();
      }
    };
  }, [navigate]);

  // Listener for new messages
  useEffect(() => {
    if (socket) {
      socket.on("sendMessage", (data) => {
        const newMessage = {
          ...data,
          isMine: data.id === socketId,
          uid: data.uid  // Ensure UID is passed through
        };
        setMessages(prev => [...prev, newMessage]);
      });
    }

    return () => {
      if (socket) socket.off("sendMessage");
    };
  }, [socketId]);

  // If not loaded yet, show loading
  if (loading) {
    return <div className="loading">Loading chat...</div>;
  }

  return (
    <div className="chatPageContainer">
      <UserSidebar 
        isOpen={sidebarOpen} 
        users={users} 
        currentUser={currentUser} 
        onLogout={handleLogout} 
        onToggle={toggleSidebar}
      />
      
      <div className="chatPage">
        <div className="chatContainer">
          <ChatHeader 
            onToggleSidebar={toggleSidebar} 
            onLogout={handleLogout}
          />
          
          <MessageList messages={messages} />
          
          <ChatInput onSendMessage={sendMessage} />
        </div>
      </div>
    </div>
  );
};

export default ChatPage;