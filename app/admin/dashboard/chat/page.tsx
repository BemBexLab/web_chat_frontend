'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { useProtectedRoute } from '@/lib/useProtectedRoute';
import DashboardLayout from '@/components/DashboardLayout';
import getSocket from '@/lib/socket';
import { playNotificationSound, unlockAudio } from '@/lib/notifications';
import { API_BASE_URL } from '@/lib/api';

interface User {
  _id: string;
  username: string;
  email: string;
  conversationId: string;
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

interface Conversation {
  _id: string;
  otherUserId: string;
  otherUserName: string;
  lastMessage: string;
  lastMessageTime?: string;
  unreadCount: number;
}

export default function AdminChatPage() {
  useProtectedRoute();
  const router = useRouter();
  const { admin, token } = useAuth(); // admin has `id` property from authContext
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const [users, setUsers] = useState<User[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUser1, setSelectedUser1] = useState<User | null>(null);
  const [selectedUser2, setSelectedUser2] = useState<User | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [tab, setTab] = useState<'conversations' | 'users' | 'members'>('conversations');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notificationsAllowed, setNotificationsAllowed] = useState<boolean>(false);

  // Fetch conversations and users on mount
  useEffect(() => {
    if (admin && token) {
      fetchConversations();
      fetchUsers();
    }
  }, [admin, token]);

  // Fetch messages when user is selected
  useEffect(() => {
    if (selectedUser && token) {
      fetchMessages(selectedUser.conversationId);
    }
  }, [selectedUser, token]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Request notification permissions on mount (don't unlock audio yet - requires gesture)
  useEffect(() => {
    const initNotifications = async () => {
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          setNotificationsAllowed(permission === 'granted');
        } else if (typeof Notification !== 'undefined') {
          setNotificationsAllowed(Notification.permission === 'granted');
        }
      } catch (e) {
        console.error('Failed to request notification permissions', e);
      }
    };

    initNotifications();
  }, []);

  // Unlock audio on user interaction (fallback for browsers that require gesture)
  useEffect(() => {
    const handleUserInteraction = () => {
      unlockAudio().catch((err) => console.error('Failed to unlock audio on interaction', err));
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('pointerdown', handleUserInteraction);
    };

    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('pointerdown', handleUserInteraction);

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('pointerdown', handleUserInteraction);
    };
  }, []);

  // NOTE: playNotificationSound will be invoked only for incoming socket messages
  // (handled in the socket "new_message" handler) so we don't play on local
  // sends or initial fetches.

  // join conversation room and listen for realtime messages
  useEffect(() => {
    const socket = getSocket();
    const handleNewMessage = (chat: any) => {
      // chat.conversationId should match selected user's conversation
      if (selectedUser && chat.conversationId === selectedUser.conversationId) {
        // Play sound only if the incoming message is from someone else
        if (chat.senderId !== admin?.id) playNotificationSound();
        setMessages((prev) => [
          ...prev,
          {
            _id: chat._id || chat.id,
            senderId: chat.senderId,
            senderName: chat.senderName,
            message: chat.message,
            createdAt: chat.createdAt || chat.timestamp || new Date().toISOString(),
            isRead: false,
          },
        ]);
      } else {
        // Incoming message for a different conversation: update unread count in-place
        if (chat.senderId !== admin?.id) playNotificationSound();
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

          // If conversation not present, prepend a new one
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

    if (selectedUser) {
      socket.emit('join', selectedUser.conversationId);
      socket.on('new_message', handleNewMessage);
    }

    return () => {
      if (selectedUser) {
        socket.emit('leave', selectedUser.conversationId);
        socket.off('new_message', handleNewMessage);
      }
    };
  }, [selectedUser]);

  // identify admin and receive presence updates
  useEffect(() => {
    const socket = getSocket();
    if (!admin || !token) return;

    const handlePresenceList = (list: string[]) => {
      setOnlineUsers(new Set(list));
    };

    const handlePresenceUpdate = ({ userId, status }: { userId: string; status: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (status === 'online') next.add(userId);
        else next.delete(userId);
        return next;
      });
    };

    socket.emit('identify', { id: admin.id, type: 'admin' });
    socket.on('presence_list', handlePresenceList);
    socket.on('presence_update', handlePresenceUpdate);

    return () => {
      socket.off('presence_list', handlePresenceList);
      socket.off('presence_update', handlePresenceUpdate);
    };
  }, [admin, token]);

  // Global new_message listener to keep conversations list updated in real-time
  useEffect(() => {
    const socket = getSocket();
    if (!admin || !token) return;

    const handleGlobalNewMessage = (chat: any) => {
      console.debug('admin global new_message received', chat);
      // Ignore messages sent by self
      if (chat.senderId === admin?.id) return;

      // If it's for the currently open conversation, do not increment unread here
      if (selectedUser && chat.conversationId === selectedUser.conversationId) return;

      // Play ding for incoming message (other conversations)
      try {
        playNotificationSound();
      } catch (err) {
        console.error('playNotificationSound error', err);
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
    };

    socket.on('new_message', handleGlobalNewMessage);
    return () => {
      socket.off('new_message', handleGlobalNewMessage);
    };
  }, [admin, token, selectedUser]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/chat/conversations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch conversations');

      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch users');

      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/chat/conversations/${conversationId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch messages');

      const data = await response.json();
      setMessages(data.messages || []);
      
      // Mark messages as read
      await markAsRead(conversationId);
    } catch (error) {
      console.error('Error fetching messages:', error);
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

  const selectUserForChat = (user: User) => {
    setSelectedUser(user);
    setTab('conversations');
  };

  const fetchMemberConversation = async (userId1: string, userId2: string) => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/chat/admin/members/${userId1}/${userId2}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch member conversation');

      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Error fetching member conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!selectedUser || (!messageText.trim() && !selectedFile && !audioChunksRef.current.length)) return;

    try {
      setSendingMessage(true);
      const formData = new FormData();
      formData.append('receiverId', selectedUser._id);

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

      const response = await fetch(`${API_BASE_URL}/chat/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to send message');

      // Clear inputs and refresh messages
      setMessageText('');
      setSelectedFile(null);
      audioChunksRef.current = [];
      setRecordingTime(0);
      await fetchMessages(selectedUser.conversationId);
      await fetchConversations();
    } catch (error) {
      console.error('Error sending message:', error);
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

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          {/* <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Chat Management</h1>
            <p className="text-gray-600">Communicate with users</p>
          </div> */}

          <div className="grid grid-cols-3 gap-6 pt-6">
            {/* Users/Conversations Sidebar */}
            <div className="col-span-1 bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Messages</h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={async () => {
                      try {
                        const ok = await unlockAudio();
                        if (!ok) console.warn('Audio unlock not granted yet');
                        // Request notification permission as well
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
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setTab('conversations')}
                    className={`px-3 py-2 rounded text-sm font-medium transition ${
                      tab === 'conversations'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Conversations
                  </button>
                  <button
                    onClick={() => setTab('users')}
                    className={`px-3 py-2 rounded text-sm font-medium transition ${
                      tab === 'users'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    All Users
                  </button>
                  <button
                    onClick={() => setTab('members')}
                    className={`px-3 py-2 rounded text-sm font-medium transition ${
                      tab === 'members'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Member Chats
                  </button>
                </div>
              </div>

              <div className="divide-y divide-gray-200 flex-1 overflow-y-auto">
                {tab === 'conversations' ? (
                  // Conversations List
                  loading ? (
                    <div className="p-4 text-center text-gray-500">Loading conversations...</div>
                  ) : conversations.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No conversations yet
                    </div>
                  ) : (
                    conversations.map((conv) => (
                      <button
                        key={conv._id}
                        onClick={() => {
                          const user = users.find((u) => u._id === conv.otherUserId);
                          if (user) selectUserForChat(user);
                        }}
                        className={`w-full text-left p-4 hover:bg-gray-50 transition ${
                          selectedUser?.conversationId === conv._id
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
                                aria-hidden
                              />
                            </p>
                            <p className="text-sm text-gray-600 truncate">{conv.lastMessage}</p>
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
                ) : tab === 'users' ? (
                  // All Users List
                  users.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">No users available</div>
                  ) : (
                    users.map((user) => (
                      <button
                        key={user._id}
                        onClick={() => selectUserForChat(user)}
                        className={`w-full text-left p-4 hover:bg-gray-50 transition ${
                          selectedUser?._id === user._id
                            ? 'bg-indigo-100 border-l-4 border-indigo-600'
                            : ''
                        }`}
                      >
                        <div>
                          <p className="font-semibold text-gray-900 flex items-center">
                            <span>{user.username}</span>
                            <span
                              className={
                                onlineUsers.has(user._id)
                                  ? 'ml-2 inline-block w-2 h-2 rounded-full bg-green-500'
                                  : 'ml-2 inline-block w-2 h-2 rounded-full bg-gray-300'
                              }
                              aria-hidden
                            />
                          </p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                        </div>
                      </button>
                    ))
                  )
                ) : (
                  // Member Chat Selection
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select User 1</label>
                      <select
                        value={selectedUser1?._id || ''}
                        onChange={(e) => {
                          const user = users.find((u) => u._id === e.target.value);
                          setSelectedUser1(user || null);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 text-black rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      >
                        <option value="">Choose a user...</option>
                        {users.map((user) => (
                          <option key={user._id} value={user._id}>
                            {user.username} ({user.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select User 2</label>
                      <select
                        value={selectedUser2?._id || ''}
                        onChange={(e) => {
                          const user = users.find((u) => u._id === e.target.value);
                          setSelectedUser2(user || null);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 text-black rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      >
                        <option value="">Choose a user...</option>
                        {users.map((user) => (
                          <option key={user._id} value={user._id}>
                            {user.username} ({user.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => {
                        if (selectedUser1 && selectedUser2) {
                          fetchMemberConversation(selectedUser1._id, selectedUser2._id);
                        }
                      }}
                      disabled={!selectedUser1 || !selectedUser2}
                      className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      View Chat
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className="col-span-2 bg-white rounded-lg shadow-lg flex flex-col">
              {selectedUser || (tab === 'members' && selectedUser1 && selectedUser2 && messages.length > 0) ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-gray-200">
                    {selectedUser ? (
                      <>
                        <h3 className="text-lg font-semibold text-gray-900">{selectedUser.username}</h3>
                        <p className="text-sm text-gray-600">{selectedUser.email}</p>
                      </>
                    ) : (
                      <>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {selectedUser1?.username} ↔ {selectedUser2?.username}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {selectedUser1?.email} ↔ {selectedUser2?.email}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Messages */}
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
                            msg.senderId === admin?.id ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-xs px-4 py-2 rounded-lg ${
                              msg.senderId === admin?.id
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-200 text-gray-900'
                            }`}
                          >
                            <p className="text-sm font-semibold">{msg.senderName}</p>
                            
                            {msg.messageType === 'file' && msg.fileUrl ? (
                              <div className="mt-2">
                                <a
                                  href={`${API_BASE_URL.replace(/\/api$/,'')}${msg.fileUrl}`}
                                  download={msg.fileName}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-2 underline ${
                                    msg.senderId === admin?.id ? 'text-indigo-100' : 'text-blue-600'
                                  }`}
                                >
                                  📎 {msg.fileName}
                                </a>
                                {msg.fileSize && (
                                  <p className={`text-xs mt-1 ${msg.senderId === admin?.id ? 'text-indigo-100' : 'text-gray-600'}`}>
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
                                  <p className={`text-xs mt-1 ${msg.senderId === admin?.id ? 'text-indigo-100' : 'text-gray-600'}`}>
                                    {Math.floor(msg.voiceDuration / 60)}:{String(msg.voiceDuration % 60).padStart(2, '0')}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p>{msg.message}</p>
                            )}
                            
                            <p
                              className={`text-xs mt-1 ${
                                msg.senderId === admin?.id ? 'text-indigo-100' : 'text-gray-600'
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

                  {/* Message Input */}
                  <div className="p-4 border-t border-gray-200">
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
                          className="flex-1 px-4 py-2 text-black border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                        
                        {/* File upload button */}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                          title="Upload file"
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
                        >
                          {isRecording ? '⏹' : '🎤'}
                        </button>

                        {/* Send button */}
                        <button
                          onClick={sendMessage}
                          disabled={sendingMessage || (!messageText.trim() && !selectedFile && audioChunksRef.current.length === 0)}
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
                  {tab === 'members' ? (
                    <p>Select two users and click "View Chat"</p>
                  ) : (
                    <p>Select a user to start messaging</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
