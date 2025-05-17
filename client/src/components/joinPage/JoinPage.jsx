import React, { useState } from "react";
import { Button } from "@mui/material";
import logo from "../../assets/logo.png";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

// Authentication service URL - replace with your actual backend URL
const AUTH_API_URL = "http://localhost:8000";

const JoinPage = () => {
  const [name, setName] = useState("");
  const [uid, setuid] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleJoin = async (e) => {
    e.preventDefault();
    
    // Form validation
    if (isRegistering) {
      // Registration validation
      if (!name) {
        setError("Please enter your name to register.");
        return;
      }
      
      if (!uid) {
        setError("Please enter a Unique id.");
        return;
      }
      
      if (!password) {
        setError("Please choose a password.");
        return;
      }
      
      if (password !== confirmPassword) {
        setError("Passwords don't match.");
        return;
      }
      
      // Register API call
      try {
        setLoading(true);
        const response = await axios.post(`${AUTH_API_URL}/register`, {
          name,
          uid,
          password
        });
        
        localStorage.setItem("chatAppUser", JSON.stringify({
          id: response.data.id,
          name,
          uid,
          token: response.data.token
        }));
        
        navigate("/chat");
      } catch (error) {
        setError(error.response?.data?.message || "Registration failed. Please try again.");
      } finally {
        setLoading(false);
      }
    } else {
      // Login validation
      if (!uid) {
        setError("Please enter your id.");
        return;
      }
      
      if (!password) {
        setError("Please enter your password.");
        return;
      }
      
      // Login API call
      try {
        setLoading(true);
        const response = await axios.post(`${AUTH_API_URL}/login`, {
          uid,
          password
        });
        
        localStorage.setItem("chatAppUser", JSON.stringify({
          id: response.data.id,
          name: response.data.name,
          uid,
          token: response.data.token
        }));
        
        navigate("/chat");
      } catch (error) {
        setError(error.response?.data?.message || "Login failed. Invalid id or password.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="joinPage">
      <div className="joinContainer">
        <img src={logo} alt="logo" />
        <h1>{isRegistering ? "Create Account" : "Login"}</h1>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleJoin}>
          {isRegistering && (
            <input
              type="text"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="joinInput"
            />
          )}
          
          <input
            type="text"
            placeholder="Unique id"
            value={uid}
            onChange={(e) => setuid(e.target.value)}
            className="joinInput"
          />
          
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="joinInput"
          />
          
          {isRegistering && (
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="joinInput"
            />
          )}
          
          <Button 
            variant="contained" 
            color="primary" 
            type="submit"
            disabled={loading}
            className="joinBtn"
          >
            {loading ? "Please wait..." : isRegistering ? "Register" : "Login"}
          </Button>
        </form>
        
        <p className="toggle-auth">
          {isRegistering 
            ? "Already have an account? " 
            : "Don't have an account? "}
          <span 
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError("");
            }}
            className="toggle-link"
          >
            {isRegistering ? "Login" : "Register"}
          </span>
        </p>
      </div>
    </div>
  );
};

// Update the export to include both the component and user data
const getUser = () => {
  const userData = localStorage.getItem("chatAppUser");
  return userData ? JSON.parse(userData).name : "";
};

export const user = getUser();
export default JoinPage;