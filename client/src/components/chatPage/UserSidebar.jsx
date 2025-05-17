import React from "react";

const UserSidebar = ({ isOpen, users, currentUser, onLogout, onToggle }) => {
  return (
    <div className={`userSidebar ${isOpen ? "open" : "closed"}`}>
      <div className="sidebarHeader">
        <h3>Online Users</h3>
        <button 
          className="toggleSidebar" 
          onClick={onToggle}
        >
          {isOpen ? "×" : "≡"}
        </button>
      </div>
      
      <div className="currentUser">
        <div className="userAvatar">
          {currentUser?.name?.charAt(0).toUpperCase() || "U"}
        </div>
        <div className="userName">{currentUser?.name || "User"}</div>
        <button className="logoutBtn" onClick={onLogout}>Logout</button>
      </div>
      
      <div className="usersList">
        {users.length === 0 ? (
          <div className="noUsers">No users found</div>
        ) : (
          users.map((user) => (
            <div 
              key={user._id || user.id} 
              className="userItem"
            >
              <div className="userAvatar">
                {user.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="userInfo">
                <div className="userName">{user.name}</div>
                <div className={`userStatus ${user.online ? "online" : "offline"}`}>
                  {user.online ? "Online" : "Offline"}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default UserSidebar;