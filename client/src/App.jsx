import { Route, Routes } from "react-router-dom";

import JoinPage from "./components/joinPage/JoinPage";
import ChatPage from "./components/chatPage/ChatPage";

const App = () => {


  return (
    <Routes>
      <Route path="/" element={<JoinPage />} />
      <Route path="/chat" element={<ChatPage />} />
    </Routes>
  );
};

export default App;
