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

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState(1);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { data: session, status} = useSession();

  console.log(session?.user);
  const togglePinChat = async (
    chatId: number
  ) => {
    const chat = chats.find(
      (c) => c.id === chatId
    );

    if (!chat) return;

    const newPinned =
      !chat.pinned;

    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
              ...c,
              pinned: newPinned,
            }
          : c
      )
    );

    if (chat.dbId) {
      await fetch(
        "/api/chats/toggle-pin",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            chatId: chat.dbId,
            pinned: newPinned,
          }),
        }
      );
    }
  };
  console.log("SESSION:", session);
useEffect(() => {
  const loadChats = async () => {
    if (!session?.user?.id) return;

    const res = await fetch(
      `/api/chats/user?userId=${session.user.id}`
    );

    const dbChats = await res.json();
    dbChats[0]?.messages.forEach((msg: any) =>
      console.log(msg.id, msg.sender, msg.text)
    );
    if (dbChats.length === 0) {
      const createRes = await fetch(
        "/api/chats/create",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: "New Chat",
            userId: session.user.id,
          }),
        }
      );

      const dbChat = await createRes.json();

      const firstChat = {
        id: 1,
        dbId: dbChat.id,
        title: dbChat.title,
        messages: [],
      };

      setChats([firstChat]);
      setCurrentChatId(1);
      return;
    }

    const convertedChats = dbChats.map(
      (chat: DbChat, index: number) => ({
        id: index + 1,
        dbId: chat.id,
        title: chat.title,
        pinned: chat.pinned,
        messages: chat.messages.map(
          (msg: DbMessage) => ({
            id: msg.id,
            text: msg.text,
            sender: msg.sender,
            timestamp: msg.timestamp,
          })
        ),
      })
    );

    setChats(convertedChats);
    setCurrentChatId(convertedChats[0].id);
  };

  loadChats();
}, [session]);

  const currentChat =
    chats.find((chat) => chat.id === currentChatId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
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

  if (!session) {
    return <LoginScreen />;
  }

  if (!currentChat) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading chats...
      </div>
    );
  }

  const updateCurrentChatMessages = (
    updater: (messages: Message[]) => Message[]
  ) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === currentChatId
          ? {
              ...chat,
              messages: updater(chat.messages),
            }
          : chat
      )
    );
  };
  
 const createNewChat = async () => {
  if (!session?.user?.id) return;

  const response = await fetch(
    "/api/chats/create",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: `Chat ${chats.length + 1}`,
        userId: session.user.id,
      }),
    }
  );

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

    const chat = chats.find(
      (chat) => chat.id === id
    );

    if (!chat?.dbId) return;

    await fetch("/api/chats/delete", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chatId: chat.dbId,
      }),
    });

    const updatedChats = chats.filter(
      (chat) => chat.id !== id
    );

    setChats(updatedChats);

    if (currentChatId === id) {
      setCurrentChatId(updatedChats[0].id);
    }
  };
  const buildConversationMessages = (
    messages: Message[],
    currentMessage?: string
  ) => {
    const conversation = messages.map((msg) => ({
      role:
        msg.sender === "user"
          ? "user"
          : "assistant",
      content: msg.text,
    }));

    if (currentMessage) {
      conversation.push({
        role: "user",
        content: currentMessage,
      });
    }

    return conversation;
  };
  const handleSend = async () => {
    if (message.trim() === "") return;

    const userMessage: Message = {
      text: message,
      sender: "user",
      timestamp: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    };

    updateCurrentChatMessages((prev) => [
      ...prev,
      userMessage,
    ]);
    await fetch("/api/messages/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: userMessage.text,
        sender: userMessage.sender,
        timestamp: userMessage.timestamp,
        chatId: currentChat?.dbId 
      }),
    });
    const currentMessage = message;
    setMessage("");

    const newTitle =
      currentMessage.length > 20
        ? currentMessage.slice(0, 20) + "..."
        : currentMessage;
    
    setChats((prev) =>
      prev.map((chat) => {
        if (
          chat.id === currentChatId &&
          (chat.title.startsWith("Chat ") ||
            chat.title === "New Chat")
        ) {
          return {
            ...chat,
            title:
              currentMessage.length > 20
                ? currentMessage.slice(0, 20) + "..."
                : currentMessage,
          };
        }

        return chat;
      })
    );
    if (
      currentChat?.dbId &&
      (currentChat.title.startsWith("Chat ") ||
        currentChat.title === "New Chat")
    ) {
      await fetch("/api/chats/update-title", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId: currentChat.dbId,
          title: newTitle,
        }),
      });
    }
    try {
      setLoading(true);

      const aiTimestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      // create empty AI message first
      updateCurrentChatMessages((prev) => [
        ...prev,
        {
          text: "",
          sender: "ai",
          timestamp: aiTimestamp,
        },
      ]);

      const response = await fetch(
        "http://127.0.0.1:8000/chat-stream",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: buildConversationMessages(
              currentChat.messages,
              currentMessage
            ),
          }),
        }
      );

      if (!response.body) {
        throw new Error("No response stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value);

        const nextText = fullText + chunk;
        fullText = nextText;

        setChats((prev) =>
          prev.map((chat) => {
            if (chat.id !== currentChatId)
              return chat;

            const updatedMessages = [
              ...chat.messages,
            ];

            updatedMessages[
              updatedMessages.length - 1
            ] = {
              ...updatedMessages[
                updatedMessages.length - 1
              ],
              text: nextText,
            };

            return {
              ...chat,
              messages: updatedMessages,
            };
          })
        );
      }

      // save completed AI message
      await fetch("/api/messages/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: fullText,
          sender: "ai",
          timestamp: aiTimestamp,
          chatId: currentChat?.dbId,
        }),
      });

    } catch (error) {
      console.error(error);

      updateCurrentChatMessages((prev) => [
        ...prev,
        {
          text: "⚠️ Failed to connect to server.",
          sender: "ai",
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };
  const regenerateResponse = async (
    aiMessageIndex: number
  ) => {
    const userMessage =
      currentChat.messages[aiMessageIndex - 1];

    if (!userMessage) return;

    try {
      setLoading(true);

      const response = await fetch(
        "http://127.0.0.1:8000/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: buildConversationMessages(
              currentChat.messages.slice(
                0,
                aiMessageIndex
              )
            ),
          }),
        }
      );

      const data = await response.json();

      const newAiText = data.success
        ? data.message.content
        : "Something went wrong.";

      const activeChat = chats.find(
        (chat) => chat.id === currentChatId
      );

      const aiMessage=activeChat?.messages[aiMessageIndex];
      console.log(
        "AI MESSAGE:",
        currentChat.messages[aiMessageIndex]
      );
      console.log(
        "MESSAGE ID:",
        currentChat.messages[aiMessageIndex]?.id
      );
      if (aiMessage?.id) {
        await fetch(
          "/api/messages/update",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              messageId: aiMessage.id,
              text: newAiText,
            }),
          }
        );
        // Refetch all chats to sync all tabs with latest DB state
        if (session?.user?.id) {
          try {
            const res = await fetch(
              `/api/chats/user?userId=${session.user.id}`
            );
            const dbChats = await res.json();

            const convertedChats = dbChats.map(
              (chat: DbChat, index: number) => ({
                id: index + 1,
                dbId: chat.id,
                title: chat.title,
                messages: chat.messages.map(
                  (msg: DbMessage) => ({
                    id: msg.id,
                    text: msg.text,
                    sender: msg.sender,
                    timestamp: msg.timestamp,
                  })
                ),
              })
            );

            setChats(convertedChats);
          } catch (error) {
            console.error("Failed to sync chats:", error);
          }
        }
      }
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== currentChatId)
            return chat;

          const updatedMessages = [
            ...chat.messages,
          ];

          updatedMessages[aiMessageIndex] = {
            ...updatedMessages[aiMessageIndex],
            text: newAiText,
            sender: "ai",
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          };

          return {
            ...chat,
            messages: updatedMessages,
          };
        })
      );


    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  return (
    
    <div className="min-h-screen flex bg-black text-white">
      {/* Sidebar */}
      <div
        className={`
          fixed md:static
          top-0 left-0
          h-full
          ${sidebarCollapsed ? "w-16" : "w-64"}
          bg-zinc-900
          border-r border-zinc-800
          p-4
          z-50
          transition-transform
          ${
            sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full md:translate-x-0"
          }
        `}
      >
        <div className="flex justify-between items-center mb-4">
          {!sidebarCollapsed && (
            <h2 className="font-bold">
              Chats
            </h2>
          )}

          <button
            onClick={() =>
              setSidebarCollapsed(
                !sidebarCollapsed
              )
            }
            className="text-xl"
          >
            ☰
          </button>
        </div>

        {!sidebarCollapsed && (
          <button
            onClick={createNewChat}
            className="w-full bg-blue-500 hover:bg-blue-600 p-3 rounded-lg mb-4 font-semibold"
          >
            + New Chat
          </button>
        )}

        {!sidebarCollapsed && (
          <div className="space-y-2">
          {[...chats]
            .sort((a, b) => {
              if (a.pinned && !b.pinned)
                return -1;

              if (!a.pinned && b.pinned)
                return 1;

              return 0;
            })
            .map((chat) => (
            <div
              key={chat.id}
              onClick={() => {
                setCurrentChatId(chat.id);
                setSidebarOpen(false);

                setTimeout(() => {
                  textareaRef.current?.focus();
                }, 0);
              }}
              className={`p-3 rounded-lg cursor-pointer transition ${
                currentChatId === chat.id
                  ? "bg-zinc-700"
                  : "bg-zinc-800 hover:bg-zinc-700"
              }`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePinChat(chat.id);
                }}
              >
                {chat.pinned ? "📌" : "📍"}
              </button>
              <div className="flex justify-between items-center">
                <span>{chat.title}</span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(chat.id);
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
        

      {/* Chat Area */}
      <div className="flex-1 flex flex-col items-center p-8">
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden absolute top-4 left-4 text-2xl"
        >
          ☰
        </button>

        <div className="w-full max-w-4xl flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">
            AI Chat App
          </h1>

          {session ? (
            <div className="flex items-center gap-3">
              
              {session.user?.image ? (
                <img
                  src={session?.user?.image ?? undefined}
                  alt="Profile"
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                  }}
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
                  {session.user?.name?.charAt(0).toUpperCase() ?? "U"}
                </div>
              )}

              <span className="text-sm">
                {session.user?.name}
              </span>

              <button
                onClick={() => signOut()}
                className="bg-red-500 hover:bg-red-600 px-3 py-2 rounded-lg"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg"
            >
              Login
            </button>
          )}
        </div>

        <div className="w-full max-w-4xl border border-zinc-800 rounded-xl p-4 h-[550px] overflow-y-auto bg-zinc-950 mb-4">
          {currentChat.messages.length === 0 && (
            <div className="text-center text-zinc-500 mt-10">
              Start a conversation...
            </div>
          )}

          {currentChat.messages.map(
            (msg, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg mb-3 w-fit max-w-[80%] ${
                  msg.sender === "user"
                    ? "bg-blue-500 text-white ml-auto"
                    : "bg-zinc-800 text-white"
                }`}
              >
                <strong>
                  {msg.sender === "user"
                    ? "You"
                    : "AI"}
                  :
                </strong>{" "}
                <ReactMarkdown
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(
                        className || ""
                      );

                      return match ? (
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match[1]}
                          PreTag="div"
                        >
                          {String(children).replace(/\n$/, "")}
                        </SyntaxHighlighter>
                      ) : (
                        <code
                          className="bg-zinc-700 px-1 py-0.5 rounded"
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
                <div
                  className={`text-xs mt-2 ${
                    msg.sender === "user"
                      ? "text-blue-200"
                      : "text-zinc-400"
                  }`}
                >
                  {msg.timestamp}
                </div>

                {msg.sender === "ai" && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(msg.text)
                      }
                      className="text-xs bg-zinc-700 px-2 py-1 rounded"
                    >
                      📋 Copy
                    </button>

                    <button
                      onClick={() =>
                        regenerateResponse(index)
                      }
                      className="text-xs bg-zinc-700 px-2 py-1 rounded"
                    >
                      🔄 Regenerate
                    </button>
                  </div>
                )}
              </div>
            )
          )}

          <div ref={bottomRef} />
          </div>

        <div className="flex gap-2 w-full max-w-4xl">
          <textarea
            ref={textareaRef}
            placeholder="Type your message..."
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height =
                e.target.scrollHeight + "px";
            }}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey
              ) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            className="flex-1 border border-zinc-700 bg-zinc-900 p-3 rounded-lg resize-none max-h-60 overflow-y-auto focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={handleSend}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 px-6 rounded-lg font-semibold disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}