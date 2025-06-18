import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  MessageCircle,
  Trash2,
  Play,
  Pause,
  Square,
  Edit3,
  Check,
  X,
} from "lucide-react";

const VoiceChatApp = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [textInput, setTextInput] = useState("");
  const [transcribedText, setTranscribedText] = useState("");
  const [showTranscription, setShowTranscription] = useState(false);
  const [isEditingTranscription, setIsEditingTranscription] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState("https://speakeasy-backend-1zjp.onrender.com");
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState(null);
  const [showAudioHint, setShowAudioHint] = useState(false);
  const [isSending, setIsSending] = useState(false); // Prevent recursion

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);
  const messagesEndRef = useRef(null);
  const transcriptionRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (showTranscription && transcriptionRef.current) {
      transcriptionRef.current.focus();
    }
  }, [showTranscription]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/wav",
        });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      addMessage(
        "system",
        "Error: Could not access microphone. Please check your permissions."
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const transcribeAudio = async (audioBlob) => {
    const formData = new FormData();
    formData.append("audio_file", audioBlob, "recording.wav");
    try {
      const response = await fetch(`${apiEndpoint}/transcribe`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setTranscribedText(data.transcript);
      setShowTranscription(true);
      setIsEditingTranscription(true);
    } catch (error) {
      console.error("Error transcribing audio:", error);
      addMessage(
        "system",
        "Error: Failed to transcribe audio. Please try again."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const sendTranscribedMessage = async () => {
    if (!transcribedText.trim() || isSending) return;
    setIsSending(true);

    const message = transcribedText.trim();
    const currentMessageCount = messages.length;

    setShowTranscription(false);
    setTranscribedText("");
    setIsEditingTranscription(false);
    addMessage("user", message);

    try {
      const chatResponse = await fetch(`${apiEndpoint}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          conversation_id: "web_chat",
        }),
      });

      if (!chatResponse.ok) throw new Error("Chat API failed");

      const chatData = await chatResponse.json();

      let audioBase64 = null;
      try {
        const ttsResponse = await fetch(`${apiEndpoint}/text-to-speech`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: chatData.response }),
        });

        if (ttsResponse.ok) {
          const ttsData = await ttsResponse.json();
          audioBase64 = ttsData.audio_base64;
        }
      } catch (ttsError) {
        console.error("TTS Error:", ttsError);
      }

      addMessage("assistant", chatData.response, audioBase64);

      if (currentMessageCount === 0) {
        setShowAudioHint(true);
        setTimeout(() => setShowAudioHint(false), 5000);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      addMessage("system", `Error: Failed to send message. ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const cancelTranscription = () => {
    setShowTranscription(false);
    setTranscribedText("");
    setIsEditingTranscription(false);
  };

  const sendTextMessage = async () => {
    if (!textInput.trim()) return;

    const message = textInput.trim();
    const currentMessageCount = messages.length;

    setTextInput("");
    addMessage("user", message);

    try {
      const chatResponse = await fetch(`${apiEndpoint}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          conversation_id: "web_chat",
        }),
      });

      if (!chatResponse.ok) throw new Error("Chat API failed");

      const chatData = await chatResponse.json();

      let audioBase64 = null;
      try {
        const ttsResponse = await fetch(`${apiEndpoint}/text-to-speech`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: chatData.response }),
        });

        if (ttsResponse.ok) {
          const ttsData = await ttsResponse.json();
          audioBase64 = ttsData.audio_base64;
        }
      } catch (ttsError) {
        console.error("TTS Error:", ttsError);
      }

      addMessage("assistant", chatData.response, audioBase64);

      if (currentMessageCount === 0) {
        setShowAudioHint(true);
        setTimeout(() => setShowAudioHint(false), 5000);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      addMessage("system", `Error: Failed to send message. ${error.message}`);
    }
  };

  const arrayBufferToBase64 = (buffer) => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const addMessage = (sender, text, audioBase64 = null) => {
    const message = {
      id: Date.now(),
      sender,
      text,
      audioBase64,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, message]);
  };

  const playAudio = (audioBase64, messageId) => {
    if (isMuted || !audioBase64) return;

    try {
      const audioBlob = new Blob(
        [Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0))],
        { type: "audio/mpeg" }
      );
      const audioUrl = URL.createObjectURL(audioBlob);

      if (currentAudio) {
        currentAudio.pause();
        setIsPlaying(false);
        setPlayingMessageId(null);
      }

      const audio = new Audio(audioUrl);
      setCurrentAudio(audio);
      setIsPlaying(true);
      setPlayingMessageId(messageId);

      audio.onended = () => {
        setIsPlaying(false);
        setCurrentAudio(null);
        setPlayingMessageId(null);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setIsPlaying(false);
        setCurrentAudio(null);
        setPlayingMessageId(null);
        URL.revokeObjectURL(audioUrl);
      };

      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play();
      }
    } catch (error) {
      console.error("Error playing audio:", error);
    }
  };

  const clearConversation = async () => {
    try {
      await fetch(`${apiEndpoint}/conversation/web_chat`, {
        method: "DELETE",
      });
      setMessages([]);
    } catch (error) {
      console.error("Error clearing conversation:", error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  };

  const handleTranscriptionKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendTranscribedMessage();
    }
  };
  console.log(messages);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 overflow-hidden">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 bg-white/10 backdrop-blur-md border-b border-white/20 z-50">
        <div className="w-full px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">SpeakEasy AI</h1>
              <p className="text-sm text-gray-300">
                Your Intelligent Voice Assistant
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative group">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-2 rounded-full transition-all ${
                  isMuted
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-white/20 hover:bg-white/30"
                }`}
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5 text-white" />
                ) : (
                  <Volume2 className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
            <div className="relative group">
              <button
                onClick={clearConversation}
                className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-all"
              >
                <Trash2 className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Audio Hint */}

      {/* Main Content */}
      <main className="absolute inset-0 pt-24 pb-4 px-4 flex flex-col overflow-hidden">
        {/* Welcome Message */}
        {messages.length === 0 && !showTranscription && (
          <div className="flex-1 flex items-center justify-center w-full">
            <div className="text-center max-w-2xl mx-auto">
              <div className="w-24 h-24 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageCircle className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">
                Welcome to SpeakEasy AI
              </h2>
              <p className="text-xl text-gray-300 mb-8 max-w-md mx-auto">
                Start a conversation by clicking the microphone or typing a
                message below.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <div className="flex items-center space-x-2 text-gray-300">
                  <Mic className="w-5 h-5" />
                  <span>Voice Chat</span>
                </div>
                <div className="hidden sm:block text-gray-500">•</div>
                <div className="flex items-center space-x-2 text-gray-300">
                  <MessageCircle className="w-5 h-5" />
                  <span>Text Chat</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.length > 0 && (
          <div className="flex-1 overflow-y-auto mb-6 space-y-4 w-full mt-8">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex w-full ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                    message.sender === "user"
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                      : message.sender === "system"
                      ? "bg-red-500/20 border border-red-500/30 text-red-200"
                      : "bg-white/10 backdrop-blur-md border border-white/20 text-white"
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.text}</p>
                  <div className="flex items-center justify-between mt-2 relative">
                    {showAudioHint && message.sender !== "user" && (
                      <div className="absolute top-0 -right-10/12 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg shadow-lg z-40 animate-pulse">
                        <div className="flex items-center space-x-2">
                          <Play className="w-4 h-4" />
                          <span className="text-sm">
                            Click the play button to hear the response!
                          </span>
                        </div>
                      </div>
                    )}
                    <span className="text-xs opacity-70">
                      {message.timestamp}
                    </span>
                    {message.audioBase64 && (
                      <div className="relative group">
                        <button
                          onClick={() =>
                            playAudio(message.audioBase64, message.id)
                          }
                          className="ml-2 p-1 rounded-full hover:bg-white/20 transition-all"
                          disabled={isMuted}
                        >
                          {isPlaying && playingMessageId === message.id ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="flex justify-start w-full">
                <div className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-3 rounded-2xl">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span className="text-sm">Processing your message...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Transcription Editor */}
        {showTranscription && (
          <div className="mb-4 w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 relative z-30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-medium flex items-center space-x-2">
                <Edit3 className="w-4 h-4" />
                <span>Edit your transcription</span>
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={sendTranscribedMessage}
                  disabled={!transcribedText.trim()}
                  className={`p-2 rounded-full transition-all ${
                    transcribedText.trim()
                      ? "bg-green-500 hover:bg-green-600"
                      : "bg-gray-600 cursor-not-allowed"
                  }`}
                >
                  <Check className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={cancelTranscription}
                  className="p-2 rounded-full bg-red-500 hover:bg-red-600 transition-all"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
            <textarea
              ref={transcriptionRef}
              value={transcribedText}
              onChange={(e) => setTranscribedText(e.target.value)}
              onKeyPress={handleTranscriptionKeyPress}
              className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none min-h-[80px] max-h-40"
              placeholder="Your transcribed message will appear here..."
              rows="3"
            />
            <p className="text-xs text-gray-400 mt-2">
              Edit the transcription above and press Enter or click ✓ to send
            </p>
          </div>
        )}

        {/* Input Area */}
        <div className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4">
          {/* Voice Recording Status */}
          {isRecording && (
            <div className="mb-4 flex items-center justify-center space-x-3 text-red-400">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">
                Recording... Tap to stop
              </span>
            </div>
          )}
          <div className="flex items-end space-x-3 w-full">
            {/* Voice Button */}
            <div className="relative group">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing || showTranscription}
                className={`p-4 rounded-full transition-all transform hover:scale-105 flex-shrink-0 ${
                  isRecording
                    ? "bg-red-500 hover:bg-red-600 animate-pulse"
                    : isProcessing || showTranscription
                    ? "bg-gray-600 cursor-not-allowed"
                    : "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                }`}
              >
                {isRecording ? (
                  <Square className="w-6 h-6 text-white" />
                ) : isProcessing ? (
                  <div className="w-6 h-6 animate-spin rounded-full border-2 border-white border-b-transparent" />
                ) : (
                  <Mic className="w-6 h-6 text-white" />
                )}
              </button>
            </div>

            {/* Text Input */}
            {!showTranscription && (
              <div className="flex-1 flex items-end space-x-2 min-w-0">
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message here..."
                  className="flex-1 px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none min-h-[48px] max-h-32 w-full"
                  rows="1"
                />
                <button
                  onClick={sendTextMessage}
                  disabled={!textInput.trim()}
                  className={`p-3 rounded-full transition-all flex-shrink-0 ${
                    textInput.trim()
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 transform hover:scale-105"
                      : "bg-gray-600 cursor-not-allowed"
                  }`}
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400">
            <span>• Click mic to record voice message</span>
            <span>• Press Enter to send text</span>
            {!isMuted && <span>• Audio responses available</span>}
          </div>
        </div>
      </main>
    </div>
  );
};

export default VoiceChatApp;
