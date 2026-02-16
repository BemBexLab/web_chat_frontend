'use client';

import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useUserAuth } from '@/lib/userAuthContext';
import { useUserProtectedRoute } from '@/lib/useUserProtectedRoute';
import UserDashboardLayout from '@/components/UserDashboardLayout';
import getSocket from '@/lib/socket';
import { playNotificationSound, unlockAudio } from '@/lib/notifications';

interface Conversation {
  _id: string;
  otherUserId: string;
  otherUserName: string;
  lastMessage: string;
  lastMessageTime?: string;
  unreadCount: number;
}

interface Message {
  _id: string;
  senderId: string;
  senderName: string;
  message?: string;
  messageType?: 'text' | 'file' | 'voice';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  voiceUrl?: string;
  voiceDuration?: number;
  createdAt: string;
  isRead: boolean;
}

export default function UserChatPage() {
  useUserProtectedRoute();
  const router = useRouter();
  const { user, token } = useUserAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'conversations' | 'users'>('conversations');
  const [allUsers, setAllUsers] = useState<
    Array<{ _id: string; username: string; email: string; conversationId: string }>
  >([]);
  const [search, setSearch] = useState('');
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notificationsAllowed, setNotificationsAllowed] = useState<boolean>(false);

  interface ChatAdmin {
    _id: string;
    email: string;
    conversationId: string;
  }

  const [admin, setAdmin] = useState<ChatAdmin | null>(null);

  /* ================= FETCH DATA ================= */

  useEffect(() => {
    if (user && token) {
      (async () => {
        await fetchConversations();
        const adm = await fetchAdminInfo();
        await fetchAllUsers(adm);
      })();
    }
  }, [user, token]);

  useEffect(() => {
    if (selectedConversation && token) {
      fetchMessages(selectedConversation._id);
    }
  }, [selectedConversation, token]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // NOTE: playNotificationSound will be invoked only for incoming socket messages
  // (handled in the socket "new_message" handler) so we don't play on local
  // sends or initial fetches.

  /* ================= SOCKET ================= */

  useEffect(() => {
    const socket = getSocket();

    const handleNewMessage = (chat: any) => {
      if (selectedConversation && chat.conversationId === selectedConversation._id) {
        // Play sound only if the incoming message is from someone else
        if (chat.senderId !== user?.id) playNotificationSound();
        if (chat.senderId !== user?.id) {
          try {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              const title = chat.senderName || 'New message';
              const body = chat.messageType === 'text' ? chat.message : chat.fileName || 'Sent a file';
              // eslint-disable-next-line no-new
              new Notification(title, { body });
            }
          } catch (e) {
            console.error('Failed to show system notification', e);
          }
        }
        setMessages((prev) => [
          ...prev,
          {
            _id: chat._id || chat.id,
            senderId: chat.senderId,
            senderName: chat.senderName,
            message: chat.message,
            createdAt:
              chat.createdAt || chat.timestamp || new Date().toISOString(),
            isRead: false,
          },
        ]);
      } else {
        // Incoming message for a different conversation: update unread count in-place
        if (chat.senderId !== user?.id) {
          playNotificationSound();
          try {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              const title = chat.senderName || 'New message';
              const body = chat.messageType === 'text' ? chat.message : chat.fileName || 'Sent a file';
              // eslint-disable-next-line no-new
              new Notification(title, { body });
            }
          } catch (e) {
            console.error('Failed to show system notification', e);
          }
        }
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c._id === chat.conversationId);
          const time = chat.createdAt || chat.timestamp || new Date().toISOString();
          if (idx !== -1) {
            const updated = [...prev];
            const conv = updated[idx];
            updated[idx] = {
              ...conv,
              unreadCount: (conv.unreadCount || 0) + 1,
              lastMessage: chat.message || conv.lastMessage,
              lastMessageTime: time,
            };
            return updated;
          }

          const newConv = {
            _id: chat.conversationId,
            otherUserId: chat.senderId,
            otherUserName: chat.senderName || 'Unknown',
            lastMessage: chat.message || '',
            lastMessageTime: time,
            unreadCount: 1,
          } as Conversation;
          return [newConv, ...prev];
        });
      }
    };

    if (selectedConversation) {
      socket.emit('join', selectedConversation._id);
      socket.on('new_message', handleNewMessage);
    }

    return () => {
      if (selectedConversation) {
        socket.emit('leave', selectedConversation._id);
        socket.off('new_message', handleNewMessage);
      }
    };
  }, [selectedConversation]);

  useEffect(() => {
    const socket = getSocket();
    if (!user || !token) return;

    const handlePresenceList = (list: string[]) => {
      setOnlineUsers(new Set(list));
    };

    const handlePresenceUpdate = ({
      userId,
      status,
    }: {
      userId: string;
      status: string;
    }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (status === 'online') next.add(userId);
        else next.delete(userId);
        return next;
      });
    };

    socket.emit('identify', { id: user.id, type: 'user' });
    socket.on('presence_list', handlePresenceList);
    socket.on('presence_update', handlePresenceUpdate);

    return () => {
      socket.off('presence_list', handlePresenceList);
      socket.off('presence_update', handlePresenceUpdate);
    };
  }, [user, token]);

  // Global new_message listener to keep conversations list updated in real-time
  useEffect(() => {
    const socket = getSocket();
    if (!user || !token) return;

    const handleGlobalNewMessage = (chat: any) => {
      console.debug('user global new_message received', chat);
      // Ignore messages sent by self
      if (chat.senderId === user?.id) return;

      // If it's for the currently open conversation, do not increment unread here
      if (selectedConversation && chat.conversationId === selectedConversation._id) return;

      // Play ding for incoming message (other conversations)
      try {
        playNotificationSound();
      } catch (err) {
        console.error('playNotificationSound error', err);
      }

      // Show desktop notification when allowed
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const title = chat.senderName || 'New message';
          const body = chat.messageType === 'text' ? chat.message : chat.fileName || 'Sent a file';
          // eslint-disable-next-line no-new
          new Notification(title, { body });
        }
      } catch (e) {
        console.error('Failed to show system notification', e);
      }

      // Update conversations list: increment unread or add conversation
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c._id === chat.conversationId);
        const time = chat.createdAt || chat.timestamp || new Date().toISOString();
        if (idx !== -1) {
          const updated = [...prev];
          const conv = updated[idx];
          updated[idx] = {
            ...conv,
            unreadCount: (conv.unreadCount || 0) + 1,
            lastMessage: chat.message || conv.lastMessage,
            lastMessageTime: time,
          };
          return updated;
        }

        const newConv = {
          _id: chat.conversationId,
          otherUserId: chat.senderId,
          otherUserName: chat.senderName || 'Unknown',
          lastMessage: chat.message || '',
          lastMessageTime: time,
          unreadCount: 1,
        } as Conversation;
        return [newConv, ...prev];
      });
    };

    socket.on('new_message', handleGlobalNewMessage);
    return () => {
      socket.off('new_message', handleGlobalNewMessage);
    };
  }, [user, token, selectedConversation]);

  /* ================= API ================= */

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/chat/conversations`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', response.status, errorData);
        throw new Error(`Failed to fetch conversations: ${errorData.message || response.status}`);
      }
      const data = await response.json();
      console.log('Conversations fetched:', data.conversations);
      setConversations(data.conversations || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminInfo = async (): Promise<ChatAdmin | null> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/chat/admin`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch admin info');
      const data = await response.json();
      setAdmin(data.admin);
      return data.admin;
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  const fetchAllUsers = async (adminParam?: ChatAdmin | null) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/chat/users`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      const usersList = (data.users || []).filter(
        (u: any) => u._id !== user?.id
      );
      const adm = adminParam || admin;
      if (adm && adm._id !== user?.id) {
        usersList.unshift({
          _id: adm._id,
          username: 'Admin',
          email: adm.email,
          conversationId: adm.conversationId,
        });
      }
      setAllUsers(usersList);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/chat/conversations/${conversationId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      setMessages(data.messages || []);
      
      // Mark messages as read
      await markAsRead(conversationId);
    } catch (error) {
      console.error(error);
    }
  };

  const markAsRead = async (conversationId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/chat/conversations/${conversationId}/read`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        // Update conversations to set unreadCount to 0 for this conversation
        setConversations((prev) =>
          prev.map((conv) =>
            conv._id === conversationId ? { ...conv, unreadCount: 0 } : conv
          )
        );
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const startConversationWithUser = (u: {
    _id: string;
    username: string;
    email: string;
    conversationId: string;
  }) => {
    const conversation: Conversation = {
      _id: u.conversationId,
      otherUserId: u._id,
      otherUserName: u.username,
      lastMessage: '',
      unreadCount: 0,
    };
    setSelectedConversation(conversation);
    setTab('conversations');
  };

  const filteredAllUsers = allUsers.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const sendMessage = async () => {
    if ((user as any)?.suspended) {
      console.warn('Attempt to send while suspended');
      return;
    }

    if (!selectedConversation || (!messageText.trim() && !selectedFile && !audioChunksRef.current.length)) return;

    try {
      setSendingMessage(true);

      const receiverId = selectedConversation.otherUserId;
      const formData = new FormData();
      formData.append('receiverId', receiverId);

      if (messageText.trim()) {
        formData.append('message', messageText);
      }

      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      if (audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        formData.append('voice', audioBlob);
        formData.append('voiceDuration', recordingTime.toString());
      }

      const response = await fetch(
        `${API_BASE_URL}/chat/send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) throw new Error('Failed to send message');

      setMessageText('');
      setSelectedFile(null);
      audioChunksRef.current = [];
      setRecordingTime(0);
      await fetchMessages(selectedConversation._id);
      await fetchConversations();
    } catch (error) {
      console.error(error);
    } finally {
      setSendingMessage(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Update recording time
      const timer = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      return () => clearInterval(timer);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  /* ================= UI ================= */

  return (
    <UserDashboardLayout>
      {(user as any)?.suspended && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-4 mx-auto max-w-7xl mt-4 rounded">
          Your account has been suspended by an administrator. You cannot view or send messages.
        </div>
      )}
      <div className="min-h-[515px] bg-gradient-to-br from-indigo-50 to-blue-50">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          {/* <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Chat Management
            </h1>
            <p className="text-gray-600">Communicate with users</p>
          </div> */}

          <div className="grid grid-cols-3 gap-6 pt-6">

            {/* Sidebar */}
            <div className="col-span-1 text-black bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  Messages
                </h2>
                <div className="mt-2">
                  <button
                    onClick={async () => {
                      try {
                        const ok = await unlockAudio();
                        if (!ok) console.warn('Audio unlock not granted yet');
                        if (typeof Notification !== 'undefined' && Notification.requestPermission) {
                          const p = await Notification.requestPermission();
                          setNotificationsAllowed(p === 'granted');
                        }
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                    className="text-sm px-2 py-1 bg-gray-100 rounded"
                  >
                    Enable sound
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTab('conversations')}
                    className={`flex-1 px-3 py-2 rounded text-sm font-medium transition ${
                      tab === 'conversations'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Conversations
                  </button>
                  <button
                    onClick={() => setTab('users')}
                    className={`flex-1 px-3 py-2 rounded text-sm font-medium transition ${
                      tab === 'users'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    All Users
                  </button>
                </div>
              </div>

              <div className="divide-y divide-gray-200 flex-1 overflow-y-auto">

                {tab === 'conversations' ? (
                  loading ? (
                    <div className="p-4 text-center text-gray-500">
                      Loading conversations...
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No conversations yet
                    </div>
                  ) : (
                    conversations.map((conv) => (
                      <button
                        key={conv._id}
                        onClick={() => setSelectedConversation(conv)}
                        className={`w-full text-left p-4 hover:bg-gray-50 transition ${
                          selectedConversation?._id === conv._id
                            ? 'bg-indigo-100 border-l-4 border-indigo-600'
                            : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 flex items-center">
                              <span>{conv.otherUserName}</span>
                              <span
                                className={
                                  onlineUsers.has(conv.otherUserId)
                                    ? 'ml-2 inline-block w-2 h-2 rounded-full bg-green-500'
                                    : 'ml-2 inline-block w-2 h-2 rounded-full bg-gray-300'
                                }
                              />
                            </p>
                            <p className="text-sm text-gray-600 truncate">
                              {conv.lastMessage}
                            </p>
                          </div>
                          {conv.unreadCount > 0 && (
                            <div className="ml-2 bg-indigo-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                              {conv.unreadCount}
                            </div>
                          )}
                        </div>
                      </button>
                    ))
                  )
                ) : (
                  <div className="p-4">
                    <input
                      type="text"
                      placeholder="Search by username..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md mb-3"
                    />
                    {filteredAllUsers.map((u) => (
                      <button
                        key={u._id}
                        onClick={() => startConversationWithUser(u)}
                        className="w-full text-left p-4 hover:bg-gray-50 transition"
                      >
                        <p className="font-semibold">{u.username}</p>
                        <p className="text-sm text-gray-500">{u.email}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className="col-span-2 bg-white rounded-lg shadow-lg flex flex-col">

              {selectedConversation ? (
                <>
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {selectedConversation.otherUserName}
                    </h3>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-96 flex flex-col">
                    {messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        <p>No messages yet. Start the conversation!</p>
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg._id}
                          className={`flex ${
                            msg.senderId === user?.id
                              ? 'justify-end'
                              : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-xs px-4 py-2 rounded-lg ${
                              msg.senderId === user?.id
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-200 text-gray-900'
                            }`}
                          >
                            <p className="text-sm font-semibold">
                              {msg.senderName}
                            </p>

                            {msg.messageType === 'file' && msg.fileUrl ? (
                              <div className="mt-2">
                                <a
                                  href={`${API_BASE_URL.replace(/\/api$/,'')}${msg.fileUrl}`}
                                  download={msg.fileName}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-2 underline ${
                                    msg.senderId === user?.id ? 'text-indigo-100' : 'text-blue-600'
                                  }`}
                                >
                                  📎 {msg.fileName}
                                </a>
                                {msg.fileSize && (
                                  <p className={`text-xs mt-1 ${msg.senderId === user?.id ? 'text-indigo-100' : 'text-gray-600'}`}>
                                    {(msg.fileSize / 1024 / 1024).toFixed(2)} MB
                                  </p>
                                )}
                              </div>
                            ) : msg.messageType === 'voice' && msg.voiceUrl ? (
                              <div className="mt-2">
                                <audio
                                  controls
                                  className="w-48"
                                  src={`${API_BASE_URL.replace(/\/api$/,'')}${msg.voiceUrl}`}
                                />
                                {msg.voiceDuration && (
                                  <p className={`text-xs mt-1 ${msg.senderId === user?.id ? 'text-indigo-100' : 'text-gray-600'}`}>
                                    {Math.floor(msg.voiceDuration / 60)}:{String(msg.voiceDuration % 60).padStart(2, '0')}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p>{msg.message}</p>
                            )}

                            <p
                              className={`text-xs mt-1 ${
                                msg.senderId === user?.id
                                  ? 'text-indigo-100'
                                  : 'text-gray-600'
                              }`}
                            >
                              {new Date(msg.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="p-4 border-t text-black border-gray-200">
                    <div className="space-y-3">
                      {/* Selected file display */}
                      {selectedFile && (
                        <div className="flex items-center justify-between bg-gray-100 p-2 rounded">
                          <span className="text-sm text-gray-700">📎 {selectedFile.name}</span>
                          <button
                            onClick={() => setSelectedFile(null)}
                            className="text-red-600 hover:text-red-800"
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      {/* Recording indicator */}
                      {isRecording && (
                        <div className="flex items-center gap-2 bg-red-100 p-2 rounded">
                          <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
                          <span className="text-sm text-red-700">Recording: {recordingTime}s</span>
                        </div>
                      )}

                      {/* Input controls */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Type your message..."
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !sendingMessage && !isRecording) {
                              sendMessage();
                            }
                          }}
                          className="flex-1 text-black px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                        
                        {/* File upload button */}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                          title="Upload file"
                          disabled={(user as any)?.suspended}
                        >
                          📎
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          onChange={handleFileSelect}
                          className="hidden"
                        />

                        {/* Voice recording button */}
                        <button
                          onClick={isRecording ? stopRecording : startRecording}
                          className={`px-4 py-2 text-white rounded-lg transition ${
                            isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                          }`}
                          title={isRecording ? 'Stop recording' : 'Start recording'}
                          disabled={(user as any)?.suspended}
                        >
                          {isRecording ? '⏹' : '🎤'}
                        </button>

                        {/* Send button */}
                        <button
                          onClick={sendMessage}
                          disabled={
                            sendingMessage ||
                            (user as any)?.suspended ||
                            (!messageText.trim() && !selectedFile && audioChunksRef.current.length === 0)
                          }
                          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          {sendingMessage ? 'Sending...' : 'Send'}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p>Select a conversation to start messaging</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </UserDashboardLayout>
  );
}
