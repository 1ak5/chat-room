document.addEventListener("DOMContentLoaded", () => {
  // Common helper functions
  const displayMessage = (element, message, isError = true) => {
    if (element) {
      element.textContent = message
      element.style.color = isError ? "var(--red-error)" : "var(--primary-color)"
      element.style.display = "block"
    }
  }

  const clearMessage = (element) => {
    if (element) {
      element.textContent = ""
      element.style.display = "none"
    }
  }

  // Check if user is already logged in and redirect accordingly
  const checkAuthAndRedirect = async () => {
    // Only check on root/index page
    if (window.location.pathname === "/" || window.location.pathname === "/index.html") {
      try {
        const response = await fetch("/api/user/me")
        if (response.ok) {
          const data = await response.json()
          // If user has active chat room, go directly to chat
          if (data.currentChatRoomId) {
            window.location.href = "/chat"
            return true // Indicate redirect happened
          } else {
            // User logged in but no chat room, go to chat rooms
            window.location.href = "/chat-rooms"
            return true // Indicate redirect happened
          }
        }
      } catch (error) {
        // User not logged in, stay on login page
        console.log("User not logged in, showing login page")
      }
    }
    return false // No redirect happened
  }

  // Auth Page Logic (index.html)
  if (window.location.pathname === "/" || window.location.pathname === "/index.html") {
    // First check if user is already logged in
    checkAuthAndRedirect().then((redirected) => {
      if (redirected) return // If redirected, don't initialize login form

      const authForm = document.getElementById("auth-form")
      const authTitle = document.getElementById("auth-title")
      const authDescription = document.getElementById("auth-description")
      const authButton = document.getElementById("auth-button")
      const switchText = document.getElementById("switch-text")
      const switchButton = document.getElementById("switch-button")
      const errorMessage = document.getElementById("error-message")

      let isLoginMode = true

      const updateAuthMode = () => {
        if (isLoginMode) {
          authTitle.textContent = "Login"
          authDescription.textContent = "Enter your credentials to access your chat."
          authButton.textContent = "Login"
          switchText.textContent = "Don't have an account?"
          switchButton.textContent = "Register"
        } else {
          authTitle.textContent = "Register"
          authDescription.textContent = "Create a new account to start chatting."
          authButton.textContent = "Register"
          switchText.textContent = "Already have an account?"
          switchButton.textContent = "Login"
        }
        clearMessage(errorMessage)
      }

      switchButton.addEventListener("click", () => {
        isLoginMode = !isLoginMode
        updateAuthMode()
      })

      authForm.addEventListener("submit", async (e) => {
        e.preventDefault()
        clearMessage(errorMessage)

        const username = authForm.username.value
        const pin = authForm.pin.value

        authButton.disabled = true
        authButton.textContent = isLoginMode ? "Logging in..." : "Registering..."

        const endpoint = isLoginMode ? "/api/auth/login" : "/api/auth/register"

        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, pin }),
          })

          const data = await response.json()

          if (response.ok) {
            displayMessage(errorMessage, data.message, false)
            setTimeout(() => {
              window.location.href = data.redirect
            }, 1000)
          } else {
            displayMessage(errorMessage, data.message || "An unexpected error occurred.")
          }
        } catch (error) {
          displayMessage(errorMessage, "Network error. Please try again.")
        } finally {
          authButton.disabled = false
          authButton.textContent = isLoginMode ? "Login" : "Register"
        }
      })

      updateAuthMode()
    })
  }

  // Chat Rooms Page Logic (chat-rooms.html)
  if (window.location.pathname === "/chat-rooms" || window.location.pathname === "/chat-rooms.html") {
    // Check if user already has an active chat room and redirect to chat
    const checkExistingChatRoom = async () => {
      try {
        const response = await fetch("/api/user/me")
        if (response.ok) {
          const data = await response.json()
          if (data.currentChatRoomId) {
            // User already has active chat room, redirect to chat
            window.location.href = "/chat"
            return true
          }
        }
      } catch (error) {
        console.log("Error checking existing chat room")
      }
      return false
    }

    checkExistingChatRoom().then((redirected) => {
      if (redirected) return // If redirected, don't initialize chat rooms page

      const tabButtons = document.querySelectorAll(".tab-button")
      const tabContents = document.querySelectorAll(".tab-content")
      const createChatForm = document.getElementById("create-chat-form")
      const joinChatForm = document.getElementById("join-chat-form")
      const createChatButton = document.getElementById("create-chat-button")
      const joinChatButton = document.getElementById("join-chat-button")
      const logoutButton = document.getElementById("logout-button")
      const currentUsernameDisplay = document.getElementById("current-username-display")
      const createErrorMessage = document.getElementById("create-error-message")
      const joinErrorMessage = document.getElementById("join-error-message")

      const fetchAndDisplayUsername = async () => {
        try {
          const response = await fetch("/api/user/me")
          if (response.status === 401) {
            window.location.href = "/"
            return
          }
          if (!response.ok) {
            throw new Error("Failed to fetch current user")
          }
          const data = await response.json()
          if (currentUsernameDisplay) {
            currentUsernameDisplay.textContent = `Logged in as: ${data.username}`
          }
        } catch (error) {
          if (currentUsernameDisplay) {
            currentUsernameDisplay.textContent = "Error loading username."
          }
        }
      }

      fetchAndDisplayUsername()

      tabButtons.forEach((button) => {
        button.addEventListener("click", () => {
          tabButtons.forEach((btn) => btn.classList.remove("active"))
          tabContents.forEach((content) => content.classList.remove("active"))

          button.classList.add("active")
          document.getElementById(`${button.dataset.tab}-chat-form`).classList.add("active")
          clearMessage(createErrorMessage)
          clearMessage(joinErrorMessage)
        })
      })

      createChatForm.addEventListener("submit", async (e) => {
        e.preventDefault()
        clearMessage(createErrorMessage)

        const name = createChatForm["create-chat-name"].value
        const pin = createChatForm["create-chat-pin"].value

        createChatButton.disabled = true
        createChatButton.textContent = "Creating..."

        try {
          const response = await fetch("/api/chatrooms/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, pin }),
          })
          const data = await response.json()

          if (response.ok) {
            displayMessage(createErrorMessage, data.message, false)
            setTimeout(() => {
              window.location.href = data.redirect
            }, 1000)
          } else {
            displayMessage(createErrorMessage, data.message || "Failed to create chat room.")
          }
        } catch (error) {
          displayMessage(createErrorMessage, "Network error. Please try again.")
        } finally {
          createChatButton.disabled = false
          createChatButton.textContent = "Create & Join Chat"
        }
      })

      joinChatForm.addEventListener("submit", async (e) => {
        e.preventDefault()
        clearMessage(joinErrorMessage)

        const name = joinChatForm["join-chat-name"].value
        const pin = joinChatForm["join-chat-pin"].value

        joinChatButton.disabled = true
        joinChatButton.textContent = "Joining..."

        try {
          const response = await fetch("/api/chatrooms/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, pin }),
          })
          const data = await response.json()

          if (response.ok) {
            displayMessage(joinErrorMessage, data.message, false)
            setTimeout(() => {
              window.location.href = data.redirect
            }, 1000)
          } else {
            displayMessage(joinErrorMessage, data.message || "Failed to join chat room.")
          }
        } catch (error) {
          displayMessage(joinErrorMessage, "Network error. Please try again.")
        } finally {
          joinChatButton.disabled = false
          joinChatButton.textContent = "Join Chat"
        }
      })

      logoutButton.addEventListener("click", async () => {
        try {
          const response = await fetch("/api/auth/logout", { method: "POST" })
          const data = await response.json()
          if (response.ok) {
            window.location.href = data.redirect
          } else {
            alert("Failed to logout. Please try again.")
          }
        } catch (error) {
          alert("Network error during logout. Please try again.")
        }
      })
    })
  }

  // Chat Page Logic (chat.html)
  if (window.location.pathname === "/chat" || window.location.pathname === "/chat.html") {
    const chatRoomNameHeader = document.getElementById("chat-room-name")
    const onlineUsersList = document.getElementById("online-users-list")
    const logoutButton = document.getElementById("logout-button")
    const leaveChatButton = document.getElementById("leave-chat-button")
    const messagesContainer = document.getElementById("messages-container")
    const messageForm = document.getElementById("message-form")
    const messageInput = document.getElementById("message-input")
    const sendButton = document.getElementById("send-button")
    const scrollToBottomBtn = document.getElementById("scroll-to-bottom-btn")
    const scrollLockToggleBtn = document.getElementById("scroll-lock-toggle-btn") // New button

    let currentUserId = null
    let currentUsername = ""
    let currentChatRoomId = null
    let messagesCache = []
    let isScrollLocked = true // Default to scroll lock ON

    const createMessageBubbleElement = (msg) => {
      const messageBubble = document.createElement("div")
      messageBubble.classList.add("message-bubble")
      messageBubble.classList.add(msg.userId === currentUserId ? "sent" : "received")
      messageBubble.dataset.messageId = msg._id

      const usernameSpan = document.createElement("div")
      usernameSpan.classList.add("message-username")
      usernameSpan.textContent = msg.username

      const contentP = document.createElement("p")
      contentP.classList.add("message-content")
      contentP.textContent = msg.content

      const timestampSpan = document.createElement("div")
      timestampSpan.classList.add("message-timestamp")
      const date = new Date(msg.timestamp)
      timestampSpan.textContent = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

      const likeHeart = document.createElement("span")
      likeHeart.classList.add("like-heart")
      likeHeart.textContent = "❤️"

      messageBubble.appendChild(usernameSpan)
      messageBubble.appendChild(contentP)
      messageBubble.appendChild(timestampSpan)
      messageBubble.appendChild(likeHeart)

      // Double-tap to like
      let tapCount = 0
      let tapTimer = null

      messageBubble.addEventListener("touchend", (event) => {
        event.preventDefault() // Prevent default touch behavior
        tapCount++

        if (tapCount === 1) {
          tapTimer = setTimeout(() => {
            tapCount = 0 // Reset if single tap
          }, 300) // 300ms window for double tap
        } else if (tapCount === 2) {
          clearTimeout(tapTimer)
          tapCount = 0
          messageBubble.classList.toggle("liked")
        }
      })

      // For desktop double click
      messageBubble.addEventListener("dblclick", () => {
        messageBubble.classList.toggle("liked")
      })

      return messageBubble
    }

    const scrollToBottom = () => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight
    }

    const toggleScrollLock = () => {
      isScrollLocked = !isScrollLocked
      if (isScrollLocked) {
        messagesContainer.style.overflowY = "hidden" // Prevent manual scrolling up
        scrollLockToggleBtn.textContent = "↑" // Up arrow for locked state
        scrollToBottom() // Scroll to bottom when locking
      } else {
        messagesContainer.style.overflowY = "auto" // Allow manual scrolling
        scrollLockToggleBtn.textContent = "↓" // Down arrow for unlocked state
      }
      // Hide the general scroll-to-bottom button when locked
      scrollToBottomBtn.style.display = isScrollLocked ? "none" : "flex"
    }

    const renderMessages = (messages) => {
      const wasAtBottom =
        messagesContainer.scrollTop + messagesContainer.clientHeight >= messagesContainer.scrollHeight - 50
      const previousMessageCount = messagesCache.length

      if (JSON.stringify(messagesCache) === JSON.stringify(messages)) {
        // Only toggle scroll button visibility if messages haven't changed and not locked
        if (!isScrollLocked) {
          toggleScrollButton()
        }
        return
      }

      messagesCache = messages

      messagesContainer.innerHTML = ""
      if (messages.length === 0) {
        messagesContainer.innerHTML =
          '<div style="text-align: center; color: #666; padding: 40px;">No messages yet. Start the conversation!</div>'
        if (!isScrollLocked) {
          toggleScrollButton()
        }
        return
      }

      messages.forEach((msg) => {
        const messageElement = createMessageBubbleElement(msg)
        messagesContainer.appendChild(messageElement)
      })

      // Auto-scroll logic:
      // If scroll is locked, always scroll to bottom.
      // If scroll is unlocked, scroll to bottom if user was at bottom OR new messages arrived OR on initial load.
      if (isScrollLocked || wasAtBottom || messages.length > previousMessageCount || previousMessageCount === 0) {
        setTimeout(() => {
          scrollToBottom()
        }, 50)
      }

      if (!isScrollLocked) {
        // Only toggle if not locked
        toggleScrollButton()
      }
    }

    const fetchMessages = async () => {
      if (!currentChatRoomId) return

      try {
        const response = await fetch(`/api/messages/${currentChatRoomId}`)
        if (response.status === 401 || response.status === 403) {
          window.location.href = "/chat-rooms"
          return
        }
        if (!response.ok) {
          throw new Error("Failed to fetch messages")
        }
        const data = await response.json()
        renderMessages(data.messages)
        return Promise.resolve()
      } catch (error) {
        console.error("Error fetching messages:", error)
        return Promise.reject(error)
      }
    }

    const renderOnlineUsers = (users) => {
      onlineUsersList.innerHTML = ""
      if (users.length === 0) {
        onlineUsersList.textContent = "No one else is online."
        return
      }
      users.forEach((user) => {
        const userItem = document.createElement("span")
        userItem.classList.add("online-user-item")
        userItem.innerHTML = `<span class="online-dot"></span>${user.username}`
        onlineUsersList.appendChild(userItem)
      })
    }

    const fetchOnlineUsers = async () => {
      if (!currentChatRoomId) return

      try {
        const response = await fetch(`/api/chatrooms/${currentChatRoomId}/online-users`)
        if (!response.ok) {
          throw new Error("Failed to fetch online users")
        }
        const data = await response.json()
        renderOnlineUsers(data.onlineUsers)
      } catch (error) {
        console.error("Error fetching online users:", error)
      }
    }

    const fetchCurrentUserAndChatRoom = async () => {
      try {
        const response = await fetch("/api/user/me")
        if (response.status === 401) {
          window.location.href = "/"
          return
        }
        if (!response.ok) {
          throw new Error("Failed to fetch current user/chat room")
        }
        const data = await response.json()
        currentUserId = data.userId
        currentUsername = data.username
        currentChatRoomId = data.currentChatRoomId

        if (!currentChatRoomId) {
          window.location.href = "/chat-rooms"
          return
        }
        chatRoomNameHeader.textContent = data.currentChatRoomName || "Chat Room"

        // Initialize scroll lock state and scroll to bottom
        // This will set isScrollLocked to true and call scrollToBottom
        toggleScrollLock()
      } catch (error) {
        console.error("Error fetching current user/chat room:", error)
        chatRoomNameHeader.textContent = "Error Loading Chat"
      }
    }

    messageForm.addEventListener("submit", async (e) => {
      e.preventDefault()
      const content = messageInput.value.trim()
      if (!content || !currentChatRoomId) return

      sendButton.disabled = true
      sendButton.textContent = "Sending..."

      const tempMessage = {
        _id: `temp-${Date.now()}`,
        userId: currentUserId,
        username: currentUsername,
        content: content,
        timestamp: new Date().toISOString(),
      }
      const optimisticMessageElement = createMessageBubbleElement(tempMessage)
      optimisticMessageElement.dataset.tempId = tempMessage._id
      messagesContainer.appendChild(optimisticMessageElement)
      scrollToBottom() // Always scroll to bottom on optimistic update

      messageInput.value = ""
      messageInput.focus()

      try {
        const response = await fetch(`/api/messages/${currentChatRoomId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        })

        if (response.status === 401 || response.status === 403) {
          window.location.href = "/chat-rooms"
          return
        }
        if (!response.ok) {
          throw new Error("Failed to send message")
        }
      } catch (error) {
        console.error("Error sending message:", error)
        const tempBubble = messagesContainer.querySelector(`[data-temp-id="${tempMessage._id}"]`)
        if (tempBubble) {
          tempBubble.remove()
        }
      } finally {
        sendButton.disabled = false
        sendButton.textContent = "Send"
      }
    })

    logoutButton.addEventListener("click", async () => {
      try {
        const response = await fetch("/api/auth/logout", { method: "POST" })
        const data = await response.json()
        if (response.ok) {
          window.location.href = data.redirect
        } else {
          alert("Failed to logout. Please try again.")
        }
      } catch (error) {
        alert("Network error during logout. Please try again.")
      }
    })

    leaveChatButton.addEventListener("click", () => {
      window.location.href = "/chat-rooms"
    })

    const toggleScrollButton = () => {
      // This function now only controls the floating scroll-to-bottom button
      // and is only active when scroll lock is OFF.
      if (!isScrollLocked) {
        const isAtBottom =
          messagesContainer.scrollTop + messagesContainer.clientHeight >= messagesContainer.scrollHeight - 20
        if (isAtBottom) {
          scrollToBottomBtn.classList.remove("visible")
        } else {
          scrollToBottomBtn.classList.add("visible")
        }
      }
    }

    messagesContainer.addEventListener("scroll", () => {
      if (!isScrollLocked) {
        // Only update floating button visibility if not locked
        toggleScrollButton()
      }
    })
    scrollToBottomBtn.addEventListener("click", scrollToBottom)

    // New event listener for the scroll lock toggle button
    scrollLockToggleBtn.addEventListener("click", toggleScrollLock)

    // Initialize chat
    fetchCurrentUserAndChatRoom().then(() => {
      if (currentChatRoomId) {
        fetchMessages() // Initial fetch, will trigger renderMessages and scroll
        setInterval(fetchMessages, 2000)
        setInterval(fetchOnlineUsers, 5000)
      }
    })
  }
})
