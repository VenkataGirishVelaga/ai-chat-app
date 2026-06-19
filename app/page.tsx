"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import LoginScreen from "@/components/LoginScreen";
import {
  useSession,
  signIn,
  signOut,
} from "next-auth/react";

type DbMessage = {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: string;
  chatId: string;
};

type DbChat = {
  id: string;
  title: string;
  userId: string;
  pinned: boolean;
  messages: DbMessage[];
};

type Message = {
  id?: string;
  text: string;
  sender: "user" | "ai";
  timestamp: string;
};

type Chat = {
  id: number;
  dbId?: string;
  title: string;
  pinned?: boolean;
  messages: Message[];
};

export default function Home() {
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatLoadError, setChatLoadError] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState(1);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { data: session, status } = useSession();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<string | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachedFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/parse-file", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        alert(data.error ?? "Failed to read file.");
        setAttachedFileName(null);
        return;
      }

      setAttachedFile(data.text);
    } catch (err) {
      console.error("File upload error:", err);
      alert("Failed to read file. Please try again.");
      setAttachedFileName(null);
    }

    e.target.value = "";
  };
  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const togglePinChat = async (chatId: number) => {
    const chat = chats.find((c) => c.id === chatId);
    if (!chat) return;

    const newPinned = !chat.pinned;

    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, pinned: newPinned } : c))
    );

    if (chat.dbId) {
      await fetch("/api/chats/toggle-pin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: chat.dbId, pinned: newPinned }),
      });
    }
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light") setDarkMode(false);
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    const loadChats = async () => {
      if (!session?.user?.id) return;

      const res = await fetch(`/api/chats/user?userId=${session.user.id}`);

      if (!res.ok) throw new Error(`Unable to load chats (${res.status})`);

      const dbChats: DbChat[] = await res.json();

      if (dbChats.length === 0) {
        const createRes = await fetch("/api/chats/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New Chat", userId: session.user.id }),
        });

        const dbChat = await createRes.json();
        const firstChat = { id: 1, dbId: dbChat.id, title: dbChat.title, messages: [] };
        setChats([firstChat]);
        setCurrentChatId(1);
        return;
      }

      const convertedChats = dbChats.map((chat: DbChat, index: number) => ({
        id: index + 1,
        dbId: chat.id,
        title: chat.title,
        pinned: chat.pinned,
        messages: chat.messages.map((msg: DbMessage) => ({
          id: msg.id,
          text: msg.text,
          sender: msg.sender,
          timestamp: msg.timestamp,
        })),
      }));

      setChats(convertedChats);
      setCurrentChatId(convertedChats[0].id);
    };

    loadChats().catch((error) => {
      console.error("Unable to load chats:", error);
      setChatLoadError(error instanceof Error ? error.message : "Unable to load chats");
    });
  }, [session]);

  const currentChat = chats.find((chat) => chat.id === currentChatId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  if (chatLoadError) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        {chatLoadError}
      </div>
    );
  }

  if (!currentChat) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading chats...
      </div>
    );
  }

  const updateCurrentChatMessages = (updater: (messages: Message[]) => Message[]) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === currentChatId ? { ...chat, messages: updater(chat.messages) } : chat
      )
    );
  };

  const createNewChat = async () => {
    if (!session?.user?.id) return;

    const response = await fetch("/api/chats/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `Chat ${chats.length + 1}`, userId: session.user.id }),
    });

    const dbChat = await response.json();
    const newChat: Chat = {
      id: Date.now(),
      dbId: dbChat.id,
      title: dbChat.title,
      pinned: dbChat.pinned,
      messages: [],
    };

    setChats((prev) => [...prev, newChat]);
    setCurrentChatId(newChat.id);
    setSidebarOpen(false);
  };

  const deleteChat = async (id: number) => {
    if (chats.length === 1) return;

    const chat = chats.find((chat) => chat.id === id);
    if (!chat?.dbId) return;

    await fetch("/api/chats/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: chat.dbId }),
    });

    const updatedChats = chats.filter((chat) => chat.id !== id);
    setChats(updatedChats);
    if (currentChatId === id) setCurrentChatId(updatedChats[0].id);
  };

  const buildConversationMessages = (messages: Message[], currentMessage?: string) => {
    const conversation = messages.map((msg) => ({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.text,
    }));

    if (currentMessage) conversation.push({ role: "user", content: currentMessage });

    return conversation;
  };

  const handleSend = async () => {
    if (!message.trim() && !attachedFile) return;

    // Combine file content + user message
    const fullMessage = attachedFile
      ? `${attachedFile}\n\nUser question: ${message}`
      : message;

    const userMessage: Message = {
      text: fullMessage,
      sender: "user",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setAttachedFile(null);
    setAttachedFileName(null);

    let userMsgIndex = 0;
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== currentChatId) return chat;
        userMsgIndex = chat.messages.length;
        return { ...chat, messages: [...chat.messages, userMessage] };
      })
    );

    const savedUserMsg = await fetch("/api/messages/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: userMessage.text,
        sender: userMessage.sender,
        timestamp: userMessage.timestamp,
        chatId: currentChat?.dbId,
      }),
    }).then((r) => r.json());

    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== currentChatId) return chat;
        const msgs = [...chat.messages];
        msgs[userMsgIndex] = { ...msgs[userMsgIndex], id: savedUserMsg.id };
        return { ...chat, messages: msgs };
      })
    );

    // Use fullMessage for title + conversation (not the bare `message`)
    const currentMessage = fullMessage;
    setMessage("");

    const shouldGenerateTitle =
      currentChat?.title.startsWith("Chat ") || currentChat?.title === "New Chat";

    const newTitle =
      message.length > 20 ? message.slice(0, 20) + "..." : message || "File upload";

    setChats((prev) =>
      prev.map((chat) => {
        if (
          chat.id === currentChatId &&
          (chat.title.startsWith("Chat ") || chat.title === "New Chat")
        ) {
          return { ...chat, title: newTitle };
        }
        return chat;
      })
    );

    if (
      currentChat?.dbId &&
      (currentChat.title.startsWith("Chat ") || currentChat.title === "New Chat")
    ) {
      await fetch("/api/chats/update-title", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: currentChat.dbId, title: newTitle }),
      });
    }

    try {
      setLoading(true);

      const aiTimestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      updateCurrentChatMessages((prev) => [
        ...prev,
        { text: "", sender: "ai", timestamp: aiTimestamp },
      ]);

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: buildConversationMessages(currentChat.messages, currentMessage),
        }),
      });

      if (!response.ok) throw new Error(`Chat server returned ${response.status}`);
      if (!response.body) throw new Error("No response stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        fullText += decoder.decode(value);

        setChats((prev) =>
          prev.map((chat) => {
            if (chat.id !== currentChatId) return chat;
            const updatedMessages = [...chat.messages];
            updatedMessages[updatedMessages.length - 1] = {
              ...updatedMessages[updatedMessages.length - 1],
              text: fullText,
            };
            return { ...chat, messages: updatedMessages };
          })
        );
      }

      const savedAiMsg = await fetch("/api/messages/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: fullText,
          sender: "ai",
          timestamp: aiTimestamp,
          chatId: currentChat?.dbId,
        }),
      }).then((r) => r.json());

      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== currentChatId) return chat;
          const msgs = [...chat.messages];
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], id: savedAiMsg.id };
          return { ...chat, messages: msgs };
        })
      );

      if (shouldGenerateTitle && currentChat?.dbId) {
        try {
          const titleResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [
                {
                  role: "system",
                  content:
                    "Create a concise 3 to 6 word title for this conversation. Return only the title, with no quotes or punctuation at the end.",
                },
                {
                  role: "user",
                  content: `User: ${message}\nAssistant: ${fullText}`,
                },
              ],
            }),
          });

          if (!titleResponse.ok) throw new Error(`Title server returned ${titleResponse.status}`);

          const titleData = await titleResponse.json();
          const generatedTitle = titleData?.message?.content
            ?.trim()
            .replace(/^["']|["']$/g, "")
            .replace(/\s+/g, " ")
            .slice(0, 60);

          if (generatedTitle) {
            setChats((prev) =>
              prev.map((chat) =>
                chat.id === currentChatId ? { ...chat, title: generatedTitle } : chat
              )
            );

            await fetch("/api/chats/update-title", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chatId: currentChat.dbId, title: generatedTitle }),
            });
          }
        } catch (error) {
          console.error("Unable to generate chat title:", error);
        }
      }
    } catch (error) {
      console.error(error);
      updateCurrentChatMessages((prev) => [
        ...prev,
        {
          text: "⚠️ Failed to connect to server.",
          sender: "ai",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const regenerateResponse = async (aiMessageIndex: number) => {
    const userMessage = currentChat.messages[aiMessageIndex - 1];
    if (!userMessage) return;

    try {
      setLoading(true);

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: buildConversationMessages(
            currentChat.messages.slice(0, aiMessageIndex)
          ),
        }),
      });

      const data = await response.json();
      const newAiText = data.success ? data.message.content : "Something went wrong.";

      const activeChat = chats.find((chat) => chat.id === currentChatId);
      const aiMessage = activeChat?.messages[aiMessageIndex];

      if (aiMessage?.id) {
        await fetch("/api/messages/update", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: aiMessage.id, text: newAiText }),
        });

        if (session?.user?.id) {
          try {
            const res = await fetch(`/api/chats/user?userId=${session.user.id}`);
            const dbChats = await res.json();
            const convertedChats = dbChats.map((chat: DbChat, index: number) => ({
              id: index + 1,
              dbId: chat.id,
              title: chat.title,
              messages: chat.messages.map((msg: DbMessage) => ({
                id: msg.id,
                text: msg.text,
                sender: msg.sender,
                timestamp: msg.timestamp,
              })),
            }));
            setChats(convertedChats);
          } catch (error) {
            console.error("Failed to sync chats:", error);
          }
        }
      }

      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== currentChatId) return chat;
          const updatedMessages = [...chat.messages];
          updatedMessages[aiMessageIndex] = {
            ...updatedMessages[aiMessageIndex],
            text: newAiText,
            sender: "ai",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          return { ...chat, messages: updatedMessages };
        })
      );
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const saveEditedMessage = async (messageId: string, index: number) => {
    try {
      setLoading(true);

      await fetch("/api/messages/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, text: editedText }),
      });

      const updatedMessages = currentChat.messages.slice(0, index + 1);
      const messagesToDelete = currentChat.messages
        .slice(index + 1)
        .filter((m) => m.id)
        .map((m) => m.id);

      if (messagesToDelete.length > 0) {
        await fetch("/api/messages/delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: messagesToDelete }),
        });
      }

      updatedMessages[index] = { ...updatedMessages[index], text: editedText };

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === currentChatId ? { ...chat, messages: updatedMessages } : chat
        )
      );

      setEditingMessageId(null);

      const aiTimestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === currentChatId
            ? {
                ...chat,
                messages: [
                  ...updatedMessages,
                  { text: "", sender: "ai" as const, timestamp: aiTimestamp },
                ],
              }
            : chat
        )
      );

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: buildConversationMessages(updatedMessages) }),
      });

      if (!response.ok) throw new Error(`Chat server returned ${response.status}`);
      if (!response.body) throw new Error("No stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value);

        setChats((prev) =>
          prev.map((chat) => {
            if (chat.id !== currentChatId) return chat;
            const msgs = [...chat.messages];
            msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], text: fullText };
            return { ...chat, messages: msgs };
          })
        );
      }

      const createAiRes = await fetch("/api/messages/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: fullText,
          sender: "ai",
          timestamp: aiTimestamp,
          chatId: currentChat.dbId,
        }),
      });

      const savedAiMessage = await createAiRes.json();

      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== currentChatId) return chat;
          const msgs = [...chat.messages];
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], id: savedAiMessage.id };
          return { ...chat, messages: msgs };
        })
      );
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`h-screen overflow-hidden flex ${
        darkMode ? "bg-[#0f0f0f] text-white" : "bg-[#f0f2f5] text-gray-900"
      }`}
    >
      {/* ── Sidebar ── */}
      <div
        className={`
          fixed md:static top-0 left-0 h-full
          ${sidebarCollapsed ? "w-16" : "w-72"}
          z-50 transition-all duration-300 flex flex-col
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          ${
            darkMode
              ? "bg-[#161616] border-r border-white/[0.06]"
              : "bg-white border-r border-gray-200 shadow-[4px_0_24px_rgba(0,0,0,0.06)]"
          }
        `}
      >
        {/* Sidebar Header */}
        <div
          className={`flex items-center justify-between px-4 py-4 border-b ${
            darkMode ? "border-white/[0.06]" : "border-gray-100"
          }`}
        >
          {!sidebarCollapsed && (
            <span
              className={`text-xs font-semibold tracking-widest uppercase ${
                darkMode ? "text-zinc-500" : "text-gray-400"
              }`}
            >
              Conversations
            </span>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`p-2 rounded-lg transition ${
              darkMode
                ? "hover:bg-white/[0.06] text-zinc-400"
                : "hover:bg-gray-100 text-gray-500"
            }`}
          >
            ☰
          </button>
        </div>

        {/* New Chat Button */}
        {!sidebarCollapsed && (
          <div className="px-3 pt-3 pb-2">
            <button
              onClick={createNewChat}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 ${
                darkMode
                  ? "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_4px_14px_rgba(59,130,246,0.4)]"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-[0_4px_14px_rgba(59,130,246,0.35)]"
              }`}
            >
              <span className="text-lg leading-none">+</span>
              New Chat
            </button>
          </div>
        )}

        {/* Chat List */}
        {!sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            {[...chats]
              .sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return 0;
              })
              .map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => {
                    setCurrentChatId(chat.id);
                    setSidebarOpen(false);
                    setTimeout(() => textareaRef.current?.focus(), 0);
                  }}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                    currentChatId === chat.id
                      ? darkMode
                        ? "bg-white/[0.1] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                        : "bg-blue-50 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.2)] shadow-sm"
                      : darkMode
                      ? "hover:bg-white/[0.05]"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePinChat(chat.id);
                      }}
                      className="shrink-0 text-sm opacity-60 hover:opacity-100 transition"
                      title={chat.pinned ? "Unpin" : "Pin"}
                    >
                      {chat.pinned ? "📌" : "📍"}
                    </button>
                    <span
                      className={`text-sm truncate font-medium ${
                        currentChatId === chat.id
                          ? darkMode
                            ? "text-white"
                            : "text-blue-700"
                          : darkMode
                          ? "text-zinc-300"
                          : "text-gray-700"
                      }`}
                    >
                      {chat.title}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(chat.id);
                    }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition ml-1 text-sm"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ── Main Chat Area ── */}
      <div className="flex-1 flex flex-col items-center px-4 py-4 overflow-hidden min-w-0">
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden absolute top-4 left-4 text-2xl"
        >
          ☰
        </button>

        {/* Top Bar */}
        <div className="w-full max-w-3xl flex items-center justify-between mb-4">
          <h1
            className={`text-xl font-bold tracking-tight ${
              darkMode ? "text-white" : "text-gray-900"
            }`}
          >
            AI Chat
          </h1>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-xl border transition ${
                darkMode
                  ? "border-white/[0.08] hover:bg-white/[0.06] text-zinc-400"
                  : "border-gray-200 hover:bg-gray-100 text-gray-500 shadow-sm"
              }`}
              title="Toggle theme"
            >
              {darkMode ? "☀️" : "🌙"}
            </button>

            {session ? (
              <div className="flex items-center gap-2">
                {session.user?.image ? (
                  <img
                    src={session.user.image}
                    alt="Profile"
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-blue-500/30"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-md">
                    {session.user?.name?.charAt(0).toUpperCase() ?? "U"}
                  </div>
                )}
                <span
                  className={`text-sm font-medium hidden sm:block ${
                    darkMode ? "text-zinc-300" : "text-gray-700"
                  }`}
                >
                  {session.user?.name}
                </span>
                <button
                  onClick={() => signOut()}
                  className="text-sm px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition shadow-sm"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn("google")}
                className="text-sm px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
              >
                Sign in
              </button>
            )}
          </div>
        </div>

        {/* Message Area */}
        <div
          className={`w-full max-w-3xl flex-1 overflow-y-auto rounded-2xl mb-3 px-4 py-4 border transition-all ${
            darkMode
              ? "bg-[#161616] border-white/[0.06] shadow-[0_0_0_1px_rgba(255,255,255,0.04),inset_0_1px_0_rgba(255,255,255,0.04)]"
              : "bg-white border-gray-200 shadow-[0_2px_24px_rgba(0,0,0,0.07),0_0_0_1px_rgba(0,0,0,0.03)]"
          }`}
        >
          {currentChat.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-20">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${
                  darkMode ? "bg-white/[0.06]" : "bg-blue-50"
                }`}
              >
                💬
              </div>
              <p className={`text-sm font-medium ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>
                Start a conversation
              </p>
              <p className={`text-xs ${darkMode ? "text-zinc-600" : "text-gray-400"}`}>
                You can also attach a PDF or TXT file using the 📎 button
              </p>
            </div>
          )}

          {currentChat.messages.map((msg, index) => (
            <div
              key={index}
              className={`flex mb-4 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              {/* AI Avatar */}
              {msg.sender === "ai" && (
                <div
                  className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mr-2 mt-1 ${
                    darkMode
                      ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white"
                      : "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md"
                  }`}
                >
                  AI
                </div>
              )}

              <div
                className={`max-w-[78%] ${
                  msg.sender === "user" ? "items-end" : "items-start"
                } flex flex-col`}
              >
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.sender === "user"
                      ? darkMode
                        ? "bg-blue-600 text-white rounded-br-sm shadow-[0_2px_12px_rgba(59,130,246,0.3)]"
                        : "bg-blue-600 text-white rounded-br-sm shadow-[0_4px_16px_rgba(59,130,246,0.35)]"
                      : darkMode
                      ? "bg-[#222222] text-zinc-100 rounded-bl-sm border border-white/[0.06] shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                      : "bg-gray-50 text-gray-800 rounded-bl-sm border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
                  }`}
                >
                  {editingMessageId === msg.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editedText}
                        onChange={(e) => setEditedText(e.target.value)}
                        className={`w-full p-2 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          darkMode
                            ? "bg-[#2a2a2a] text-zinc-100 border border-white/[0.1]"
                            : "bg-white text-gray-800 border border-gray-200"
                        }`}
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEditedMessage(msg.id!, index)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingMessageId(null)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                            darkMode
                              ? "bg-white/[0.08] hover:bg-white/[0.14] text-zinc-300"
                              : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                          }`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <ReactMarkdown
                      components={{
                        code({ className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || "");
                          return match ? (
                            <SyntaxHighlighter
                              style={oneDark}
                              language={match[1]}
                              PreTag="div"
                              customStyle={{ borderRadius: "10px", fontSize: "12px", margin: "8px 0" }}
                            >
                              {String(children).replace(/\n$/, "")}
                            </SyntaxHighlighter>
                          ) : (
                            <code
                              className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                                darkMode
                                  ? "bg-white/[0.1] text-zinc-200"
                                  : "bg-gray-200 text-gray-800"
                              }`}
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        },
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  )}
                </div>

                {/* Timestamp */}
                <span
                  className={`text-[11px] mt-1 px-1 ${
                    darkMode ? "text-zinc-600" : "text-gray-400"
                  }`}
                >
                  {msg.timestamp}
                </span>

                {msg.sender === "user" && msg.id && (
                  <button
                    onClick={() => {
                      setEditingMessageId(msg.id!);
                      setEditedText(msg.text);
                    }}
                    className="text-[11px] mt-1 px-2 py-1 rounded bg-zinc-700 text-white hover:bg-zinc-600"
                  >
                    ✏️ Edit
                  </button>
                )}

                {/* AI Action Buttons */}
                {msg.sender === "ai" && (
                  <div className="relative flex gap-1.5 mt-1 px-1">
                    <button
                      onClick={() => handleCopy(msg.text)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
                        darkMode
                          ? "bg-white/[0.06] hover:bg-white/[0.1] text-zinc-400 hover:text-zinc-200"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 shadow-sm"
                      }`}
                    >
                      📋 Copy
                    </button>
                    {copiedId === msg.text && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-xs px-2 py-1 rounded animate-pulse">
                        Copied!
                      </div>
                    )}
                    <button
                      onClick={() => regenerateResponse(index)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
                        darkMode
                          ? "bg-white/[0.06] hover:bg-white/[0.1] text-zinc-400 hover:text-zinc-200"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 shadow-sm"
                      }`}
                    >
                      🔄 Regenerate
                    </button>
                  </div>
                )}
              </div>

              {/* User Avatar */}
              {msg.sender === "user" && (
                <div
                  className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ml-2 mt-1 ${
                    darkMode
                      ? "bg-zinc-700 text-zinc-200"
                      : "bg-gray-200 text-gray-600 shadow-sm"
                  }`}
                >
                  {session?.user?.name?.charAt(0).toUpperCase() ?? "U"}
                </div>
              )}
            </div>
          ))}

          <div ref={bottomRef} />
        </div>

        {/* File attached indicator */}
        {attachedFile && (
          <div
            className={`w-full max-w-3xl mb-2 px-3 py-2 rounded-xl text-xs flex items-center justify-between ${
              darkMode
                ? "bg-green-900/30 text-green-400 border border-green-800/40"
                : "bg-green-50 text-green-700 border border-green-200"
            }`}
          >
            <span>📄 {attachedFileName ?? "File"} attached and ready to send</span>
            <button
              onClick={() => {
                setAttachedFile(null);
                setAttachedFileName(null);
              }}
              className="ml-2 hover:opacity-70 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div
          className={`w-full max-w-3xl flex items-end gap-2 p-2 rounded-2xl border transition-all ${
            darkMode
              ? "bg-[#1c1c1c] border-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
              : "bg-white border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]"
          }`}
        >
          {/* File Upload Button */}
          <label
            className={`cursor-pointer shrink-0 mb-0.5 w-9 h-9 rounded-xl flex items-center justify-center transition ${
              attachedFile
                ? "bg-green-600 text-white"
                : darkMode
                ? "bg-white/[0.06] hover:bg-white/[0.1] text-zinc-400"
                : "bg-gray-100 hover:bg-gray-200 text-gray-500"
            }`}
            title={attachedFile ? "File attached!" : "Attach PDF or TXT"}
          >
            {attachedFile ? "✅" : "📎"}
            <input
              type="file"
              accept=".pdf,.txt"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>

          <textarea
            ref={textareaRef}
            placeholder="Message AI... (or attach a PDF/TXT file)"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            className={`flex-1 px-3 py-2.5 bg-transparent resize-none max-h-48 overflow-y-auto focus:outline-none text-sm leading-relaxed placeholder:text-gray-400 ${
              darkMode ? "text-white" : "text-gray-800"
            }`}
          />

          <button
            onClick={handleSend}
            disabled={loading || (!message.trim() && !attachedFile)}
            className={`shrink-0 mb-0.5 w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold transition-all duration-200 disabled:opacity-40 ${
              darkMode
                ? "bg-blue-600 hover:bg-blue-500 shadow-[0_2px_10px_rgba(59,130,246,0.4)]"
                : "bg-blue-600 hover:bg-blue-700 shadow-[0_4px_12px_rgba(59,130,246,0.4)]"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>

        {/* Footer hint */}
        <p className={`text-[11px] mt-2 ${darkMode ? "text-zinc-700" : "text-gray-400"}`}>
          Press Enter to send · Shift + Enter for new line · 📎 to attach PDF or TXT
        </p>
      </div>
    </div>
  );
}