// server.js

const express = require("express");
const bodyParser = require("body-parser");

const app = express();
const port = 8000;

// Sample in-memory user database (replace with a real database)
let users = [];

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Registration endpoint
app.post("/register", (req, res) => {
  const { name, uid, password } = req.body;
  
  // Check if user already exists
  if (users.some(user => user.email === email)) {
    return res.status(400).json({ message: "User already exists" });
  }

  // Add user to database (in this case, an in-memory array)
  users.push({ name, uid, password });

  return res.status(201).json({ message: "User registered successfully" });
});

// Login endpoint
app.post("/login", (req, res) => {
  const { uid, password } = req.body;

  // Find user by email
  const user = users.find(user => user.uid === uid);

  // If user not found or password doesn't match, return error
  if (!user || user.password !== password) {
    return res.status(401).json({ message: "Invalid id or password" });
  }

  return res.status(200).json({ message: "Login successful" });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

