import { useState } from "react";
import { Upload, message as antdMessage, Button } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import "./App.css";

function App() {
  const [message, setMessage] = useState("");
  const [chats, setChats] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedPdfFiles, setSelectedPdfFiles] = useState([]);

  // Function to handle chat submission
  const chat = async (e) => {
    e.preventDefault();
    if (!message.trim() && selectedPdfFiles.length === 0) return;

    setIsTyping(true);
    let msgs = [...chats, { role: "user", content: message }];
    setChats(msgs);
    setMessage("");

    try {
      const response = await fetch('http://localhost:8000/chat', { // Update with your server URL
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: message }),
      });
      if (!response.ok) {
        throw new Error('Failed to get response');
      }
      const result = await response.json();

      msgs = [...msgs, { role: "bot", content: result.response }];
      setChats(msgs);
    } catch (error) {
      console.error('Chat error:', error);
      msgs = [...msgs, { role: "bot", content: "Sorry, there was an error." }];
      setChats(msgs);
    }

    setIsTyping(false);
  };

  // Function to handle file upload
  const customRequest = async ({ file, onSuccess, onError }) => {
    const formData = new FormData();
    formData.append('pdfs', file);

    try {
      const response = await fetch('http://localhost:8000/upload-pdfs', { // Update with your server URL
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error('File upload failed');
      }
      const result = await response.json();
      console.log('PDF File uploaded:', result);
      onSuccess(result, file);
      setSelectedPdfFiles((prevFiles) => [...prevFiles, file]);
    } catch (error) {
      console.error('Upload error:', error);
      antdMessage.error('Upload failed');
      onError(error);
    }
  };

  // Ant Design Upload props
  const uploadProps = {
    beforeUpload: (file) => {
      const isPdf = file.type === "application/pdf";
      if (!isPdf) {
        antdMessage.error("You can only upload PDF files!");
        return false;
      }
      return true;
    },
    customRequest,
  };

  return (
    <main>
      <h1>Chatbot</h1>
      <Upload {...uploadProps} multiple>
        <Button icon={<UploadOutlined />}>Upload PDFs</Button>
      </Upload>
      <section>
        {chats.map((chat, index) => (
          <p key={index} className={chat.role === "user" ? "user_msg" : ""}>
            <span><b>{chat.role.toUpperCase()}</b></span><span>:</span>
            <span>{chat.content}</span>
          </p>
        ))}
      </section>
      <div className={isTyping ? "" : "hide"}>
        <p><i>{isTyping ? "Typing" : ""}</i></p>
      </div>
      <form onSubmit={(e) => chat(e)}>
        <input
          type="text"
          name="message"
          value={message}
          placeholder="Type a message here and hit Enter..."
          onChange={(e) => setMessage(e.target.value)}
        />
      </form>
    </main>
  );
}

export default App;
