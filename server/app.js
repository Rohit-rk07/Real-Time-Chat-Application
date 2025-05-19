const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const users = new Map(); 
const usersById = new Map(); 
const sessions = new Map(); 
const messages = [];

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const onlineUsers = new Map();

// Socket.io middleware for authentication
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

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  // Handle user joining
  socket.on('joined', ({ user, userId }) => {
    // Store user in online users map
    onlineUsers.set(socket.id, {
      socketId: socket.id,
      userId: userId || socket.userId,
      name: user,
      uid: socket.user.uid
    });
    
    // Broadcast to others that user joined
    socket.broadcast.emit('userJoined', {
      user,
      message: `${user} has joined the chat`,
      uid: socket.user.uid,
      userId: socket.userId
    });
    
    // Send welcome message to the user
    socket.emit('welcome', {
      user: 'Admin',
      message: `Welcome to the chat, ${user}`,
      uid: 'system',
      userId: 'system'
    });
    
    // Send updated user list to all clients
    const userList = Array.from(onlineUsers.values());
    io.emit('userList', userList);
  });
  
  // Handle message sending
  socket.on('message', ({ message, id, user, uid }) => {
    const userData = onlineUsers.get(socket.id);
    const userName = user || userData?.name || 'Unknown User';
    const userUid = uid || socket.user.uid || userData?.uid || 'unknown';
    
    // Broadcast message to all clients
    io.emit('sendMessage', {
      user: userName,
      message,
      id: socket.id,
      uid: userUid,
      userId: socket.userId
    });
    
    // Store message in memory
    if (socket.userId) {
      const newMessage = {
        id: generateId(),
        _id: generateId(), // Add _id for frontend compatibility
        sender: socket.userId,
        content: message,
        timestamp: new Date()
      };
      
      messages.push(newMessage);
      
      // Keep only last 1000 messages
      if (messages.length > 1000) {
        messages.shift(); 
      }
    }
  });
  
  // Handle user disconnect
  socket.on('disconnect', () => {
    const userData = onlineUsers.get(socket.id);
    
    if (userData) {
      onlineUsers.delete(socket.id);
      
      socket.broadcast.emit('leave', {
        user: 'Admin',
        message: `${userData.name} has left the chat`,
        uid: 'system',
        userId: 'system'
      });
      
      // Send updated user list to all clients
      const userList = Array.from(onlineUsers.values());
      io.emit('userList', userList);
    }
    
    console.log(`User disconnected: ${socket.id}`);
  });
});

// REST API Routes

// User registration
app.post('/register', async (req, res) => {
  const { name, uid, password } = req.body;
  
  console.log('Registration attempt:', { name, uid, passwordLength: password?.length });
  
  try {
    // Validate input
    if (!name || !uid || !password) {
      console.log('Missing required fields');
      return res.status(400).json({ message: 'Name, UID, and password are required' });
    }
    
    // Check if user already exists
    if (users.has(uid)) {
      console.log('User already exists with UID:', uid);
      return res.status(400).json({ message: 'User already exists with this UID' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new user
    const userId = generateId();
    const user = {
      id: userId,
      _id: userId, // Add _id for frontend compatibility
      name,
      uid,
      password: hashedPassword,
      createdAt: new Date()
    };
    
    // Store user
    users.set(uid, user);
    usersById.set(userId, user);
    
    // Create session
    const sessionToken = generateSessionToken();
    sessions.set(sessionToken, userId);
    
    console.log('User registered successfully:', { userId, name, uid });
    
    res.status(201).json({
      id: userId,
      name: user.name,
      uid: user.uid,
      token: sessionToken
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration: ' + error.message });
  }
});

// User login
app.post('/login', async (req, res) => {
  const { uid, password } = req.body;
  
  console.log('Login attempt for UID:', uid);
  
  try {
    // Validate input
    if (!uid || !password) {
      console.log('Missing UID or password');
      return res.status(400).json({ message: 'UID and password are required' });
    }
    
    // Find user
    const user = users.get(uid);
    if (!user) {
      console.log('User not found with UID:', uid);
      return res.status(400).json({ message: 'Invalid UID or password' });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Password mismatch for UID:', uid);
      return res.status(400).json({ message: 'Invalid UID or password' });
    }
    
    // Create session
    const sessionToken = generateSessionToken();
    sessions.set(sessionToken, user.id);
    
    console.log('User logged in successfully:', { userId: user.id, name: user.name, uid });
    
    res.json({
      id: user.id,
      name: user.name,
      uid: user.uid,
      token: sessionToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login: ' + error.message });
  }
});

// User logout
app.post('/logout', async (req, res) => {
  const sessionToken = req.header('Authorization')?.replace('Bearer ', '');
  
  if (sessionToken && sessions.has(sessionToken)) {
    sessions.delete(sessionToken);
  }
  
  res.status(200).json({ message: 'Logged out successfully' });
});

// Authentication middleware
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

// Get all users
app.get('/users', auth, async (req, res) => {
  try {
    const usersList = Array.from(users.values()).map(user => {
      // Remove password and add compatibility fields
      const { password, ...userWithoutPassword } = user;
      return {
        ...userWithoutPassword,
        _id: user.id, // Add _id for frontend compatibility
        online: false // Will be updated by socket logic
      };
    });
    
    res.json(usersList);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error while fetching users' });
  }
});

// Get current user
app.get('/users/me', auth, async (req, res) => {
  res.json({
    id: req.user.id,
    _id: req.user.id,
    name: req.user.name,
    uid: req.user.uid
  });
});

// Get chat messages
app.get('/messages', auth, async (req, res) => {
  try {
    // Get recent messages and format them for the frontend
    const recentMessages = [...messages]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50)
      .map(message => {
        // Find sender information
        const sender = usersById.get(message.sender);
        return {
          _id: message.id,
          content: message.content,
          timestamp: message.timestamp,
          sender: {
            _id: sender?.id || message.sender,
            id: sender?.id || message.sender,
            name: sender?.name || 'Unknown User',
            uid: sender?.uid || 'unknown'
          }
        };
      });
    
    res.json(recentMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error while fetching messages' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(),
    activeUsers: onlineUsers.size,
    totalMessages: messages.length
  });
});

// Periodic cleanup of old sessions (every hour)
setInterval(() => {
  // You could add session expiration logic here
  console.log(`Active sessions: ${sessions.size}`);
  console.log(`Online users: ${onlineUsers.size}`);
}, 1000 * 60 * 60); 

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8000';
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});