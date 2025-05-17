// server.js - Backend server implementation without MongoDB or JWT

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// In-memory data stores
const users = new Map(); // email -> user
const usersById = new Map(); // userId -> user
const sessions = new Map(); // sessionToken -> userId
const messages = [];

// Generate a unique ID (simple implementation)
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Generate a session token
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store online users
const onlineUsers = new Map();

// Authentication middleware for socket.io
io.use(async (socket, next) => {
  try {
    const sessionToken = socket.handshake.auth.token;
    if (!sessionToken) {
      return next(new Error('Authentication error'));
    }
    
    const userId = sessions.get(sessionToken);
    if (!userId) {
      return next(new Error('Invalid session'));
    }
    
    const user = usersById.get(userId);
    if (!user) {
      return next(new Error('User not found'));
    }
    
    socket.userId = userId;
    socket.user = {
      id: user.id,
      name: user.name,
      uid: user.uid
    };
    
    next();
  } catch (error) {
    return next(new Error('Authentication error'));
  }
});

// Socket.io events
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  // User joins chat
  socket.on('joined', ({ user, userId }) => {
    // Add user to online users
    onlineUsers.set(socket.id, {
      socketId: socket.id,
      userId: userId || socket.userId,
      name: user
    });
    
    // Broadcast to all users
    socket.broadcast.emit('userJoined', {
      user,
      message: `${user} has joined the chat`
    });
    
    // Welcome message to the user who joined
    socket.emit('welcome', {
      user: 'Admin',
      message: `Welcome to the chat, ${user}`
    });
    
    // Send updated user list to all clients
    const userList = Array.from(onlineUsers.values());
    io.emit('userList', userList);
  });
  
  // User sends message
  socket.on('message', ({ message, id, user }) => {
    const userData = onlineUsers.get(socket.id);
    const userName = user || userData?.name || 'Unknown User';
    
    io.emit('sendMessage', {
      user: userName,
      message,
      id: socket.id
    });
    
    // Save message to in-memory store
    if (socket.userId) {
      const newMessage = {
        id: generateId(),
        sender: socket.userId,
        content: message,
        timestamp: new Date()
      };
      
      messages.push(newMessage);
      
      // Limit message history to avoid memory leaks
      if (messages.length > 1000) {
        messages.shift(); // Remove oldest message if we exceed 1000 messages
      }
    }
  });
  
  // User disconnects
  socket.on('disconnect', () => {
    const userData = onlineUsers.get(socket.id);
    
    if (userData) {
      onlineUsers.delete(socket.id);
      
      socket.broadcast.emit('leave', {
        user: 'Admin',
        message: `${userData.name} has left the chat`
      });
      
      // Send updated user list to all clients
      const userList = Array.from(onlineUsers.values());
      io.emit('userList', userList);
    }
    
    console.log(`User disconnected: ${socket.id}`);
  });
});

// API Routes

// Register user
app.post('/register', async (req, res) => {
  const { name, uid, password } = req.body;
  
  try {
    // Check if user already exists
    if (users.has(uid)) {
      return res.status(400).json({ message: 'User already exists with this id' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new user
    const userId = generateId();
    const user = {
      id: userId,
      name,
      uid,
      password: hashedPassword,
      createdAt: new Date()
    };
    
    // Store user in memory
    users.set(uid, user);
    usersById.set(userId, user);
    
    // Generate session token
    const sessionToken = generateSessionToken();
    sessions.set(sessionToken, userId);
    
    res.status(201).json({
      id: userId,
      name: user.name,
      uid: user.uid,
      token: sessionToken
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Login user
app.post('/login', async (req, res) => {
  const { uid, password } = req.body;
  
  try {
    // Find user
    const user = users.get(email);
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    // Generate session token
    const sessionToken = generateSessionToken();
    sessions.set(sessionToken, user.id);
    
    res.json({
      id: user.id,
      name: user.name,
      uid: user.uid,
      token: sessionToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Logout user
app.post('/logout', async (req, res) => {
  const sessionToken = req.header('Authorization')?.replace('Bearer ', '');
  
  if (sessionToken && sessions.has(sessionToken)) {
    sessions.delete(sessionToken);
  }
  
  res.status(200).json({ message: 'Logged out successfully' });
});

// Authentication middleware for API routes
const auth = async (req, res, next) => {
  try {
    const sessionToken = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!sessionToken) {
      throw new Error('No token provided');
    }
    
    const userId = sessions.get(sessionToken);
    if (!userId) {
      throw new Error('Invalid session');
    }
    
    const user = usersById.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    req.user = user;
    req.sessionToken = sessionToken;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Authentication required' });
  }
};

// Get all users (requires authentication)
app.get('/users', auth, async (req, res) => {
  try {
    const usersList = Array.from(users.values()).map(user => {
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    
    res.json(usersList);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error while fetching users' });
  }
});

// Get user profile (requires authentication)
app.get('/users/me', auth, async (req, res) => {
  res.json({
    id: req.user.id,
    name: req.user.name,
    uid: req.user.uid
  });
});

// Get chat history (requires authentication)
app.get('/messages', auth, async (req, res) => {
  try {
    // Sort messages by timestamp (newest first) and limit to 50
    const recentMessages = [...messages]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50)
      .map(message => {
        // Add sender name to each message
        const sender = usersById.get(message.sender);
        return {
          ...message,
          sender: {
            id: sender?.id || message.sender,
            name: sender?.name || 'Unknown User'
          }
        };
      });
    
    res.json(recentMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error while fetching messages' });
  }
});

// Session cleanup - run periodically to remove old sessions
// In a real app, you would want sessions to expire after some time
setInterval(() => {
  // For now, we're not implementing expiration
  // This is just a placeholder for where you would add that logic
  console.log(`Active sessions: ${sessions.size}`);
}, 1000 * 60 * 60); // Log active sessions count every hour

// Start server
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});