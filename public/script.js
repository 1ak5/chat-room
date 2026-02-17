document.addEventListener("DOMContentLoaded", () => {
  let selectedImage = null;

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
            // Wait a bit longer for session to be properly saved
            setTimeout(() => {
              window.location.href = data.redirect
            }, 1500)
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

      const fetchMyRooms = async () => {
        try {
          const response = await fetch("/api/chatrooms/my-rooms")
          if (response.ok) {
            const data = await response.json()
            const myRoomsSection = document.getElementById("my-rooms-section")
            const myRoomsList = document.getElementById("my-rooms-list")

            if (data.rooms && data.rooms.length > 0) {
              myRoomsSection.style.display = "block"
              myRoomsList.innerHTML = ""
              data.rooms.forEach(room => {
                const roomItem = document.createElement("div")
                roomItem.className = "my-room-item"
                roomItem.innerHTML = `<span class="my-room-name">${room.name}</span>`
                roomItem.onclick = () => {
                  document.getElementById("join-chat-name").value = room.name
                  // Switch to join tab
                  tabButtons[1].click()
                }
                myRoomsList.appendChild(roomItem)
              })
            }
          }
        } catch (error) {
          console.error("Error fetching my rooms:", error)
        }
      }

      fetchAndDisplayUsername()
      fetchMyRooms()

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
            }, 1500)
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
            }, 1500)
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
    const scrollLockToggleBtn = document.getElementById("scroll-lock-toggle-btn")
    const replyPreview = document.getElementById("reply-preview")
    const replyUsername = document.getElementById("reply-username")
    const replyMessage = document.getElementById("reply-message")
    const cancelReplyBtn = document.getElementById("cancel-reply")

    let currentUserId = null
    let currentUsername = ""
    let currentChatRoomId = null
    let messagesCache = []
    let isScrollLocked = true
    let replyingTo = null // Store the message being replied to

    const createMessageBubbleElement = (msg) => {
      const messageBubble = document.createElement("div")
      messageBubble.classList.add("message-bubble")
      messageBubble.classList.add(msg.userId === currentUserId ? "sent" : "received")
      messageBubble.dataset.messageId = msg._id

      // Add reply section if this message is a reply
      if (msg.replyTo) {
        const replyDiv = document.createElement("div")
        replyDiv.classList.add("message-reply")

        const replyUsernameSpan = document.createElement("div")
        replyUsernameSpan.classList.add("reply-username")
        replyUsernameSpan.textContent = msg.replyTo.username

        const replyContentSpan = document.createElement("div")
        replyContentSpan.classList.add("reply-content")
        replyContentSpan.textContent = msg.replyTo.content

        replyDiv.appendChild(replyUsernameSpan)
        replyDiv.appendChild(replyContentSpan)

        // Add click handler to scroll to replied message
        replyDiv.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetId = msg.replyTo._id;
          const targetBubble = document.querySelector(`[data-message-id="${targetId}"]`);

          if (targetBubble) {
            targetBubble.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetBubble.classList.add('message-highlight');
            setTimeout(() => {
              targetBubble.classList.remove('message-highlight');
            }, 2000);
          }
        });

        messageBubble.appendChild(replyDiv)
      }

      const usernameSpan = document.createElement("div")
      usernameSpan.classList.add("message-username")
      usernameSpan.textContent = msg.username

      const contentP = document.createElement("p")
      contentP.classList.add("message-content")
      contentP.textContent = msg.content

      if (msg.messageType === 'image' && msg.imageData) {
        const imageContainer = document.createElement("div");
        imageContainer.classList.add("message-image-container");

        const image = document.createElement("img");
        image.classList.add("message-image");
        image.alt = "Shared image";
        image.loading = "lazy";

        // Handle image loading states
        const loadingSpinner = document.createElement("div");
        loadingSpinner.classList.add("image-loading");
        imageContainer.appendChild(loadingSpinner);

        // Use the image data
        image.src = msg.imageData;

        // Remove loading spinner once image is loaded
        image.onload = () => {
          loadingSpinner.remove();
          image.style.opacity = "1";
        };

        // Handle image load error
        image.onerror = () => {
          loadingSpinner.remove();
          image.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEyIDJDNi40NzcgMiAyIDYuNDc3IDIgMTJzNC40NzcgMTAgMTAgMTAgMTAtNC40NzcgMTAtMTBTMTcuNTIzIDIgMTIgMnptMCAxOGMtNC40MTEgMC04LTMuNTg5LTgtOHMzLjU4OS04IDgtOCA4IDMuNTg5IDggOC0zLjU4OSA4LTggOHptMC0xM2ExIDEgMCAxIDAgMCAyIDEgMSAwIDAgMCAwLTJ6bTAgNGExIDEgMCAwIDAtMSAxdjRhMSAxIDAgMSAwIDIgMHYtNGExIDEgMCAwIDAtMS0xeiIgZmlsbD0iI2ZmMDAwMCIvPjwvc3ZnPg=='; // Error icon
          image.style.opacity = "0.5";
        };

        // Add click handler for full-screen image view
        image.addEventListener('click', () => {
          if (msg.imageData && !msg.sendingStatus) {
            // Create fullscreen overlay
            const overlay = document.createElement('div');
            overlay.className = 'fullscreen-image-overlay';

            const fullImage = document.createElement('img');
            fullImage.src = msg.imageData;
            fullImage.className = 'fullscreen-image';

            const closeBtn = document.createElement('button');
            closeBtn.className = 'fullscreen-close-btn';
            closeBtn.innerHTML = '×';

            overlay.appendChild(fullImage);
            overlay.appendChild(closeBtn);
            document.body.appendChild(overlay);

            // Handle close events
            const closeOverlay = () => {
              overlay.classList.add('closing');
              setTimeout(() => {
                document.body.removeChild(overlay);
              }, 300);
            };

            closeBtn.addEventListener('click', closeOverlay);
            overlay.addEventListener('click', (e) => {
              if (e.target === overlay) closeOverlay();
            });

            // Prevent scrolling of background
            document.body.style.overflow = 'hidden';

            overlay.addEventListener('transitionend', () => {
              if (!overlay.classList.contains('closing')) {
                overlay.classList.add('active');
              }
            });

            // Re-enable scrolling when overlay is removed
            overlay.addEventListener('animationend', () => {
              if (overlay.classList.contains('closing')) {
                document.body.style.overflow = '';
              }
            });
          }
        });

        imageContainer.appendChild(image);
        messageBubble.appendChild(imageContainer);
      }

      const statusContainer = document.createElement("div")
      statusContainer.classList.add("message-status-container")

      const timestampSpan = document.createElement("div")
      timestampSpan.classList.add("message-timestamp")
      const date = new Date(msg.timestamp)
      timestampSpan.textContent = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

      // Add sending status for messages being sent
      if (msg.sendingStatus === 'sending') {
        const statusSpan = document.createElement("span")
        statusSpan.classList.add("message-status")
        statusSpan.textContent = "sending..."
        statusContainer.appendChild(statusSpan)
      }

      statusContainer.appendChild(timestampSpan)

      const likeHeart = document.createElement("span")
      likeHeart.classList.add("like-heart")
      likeHeart.textContent = "❤️"

      messageBubble.appendChild(usernameSpan)
      messageBubble.appendChild(contentP)
      messageBubble.appendChild(statusContainer)
      messageBubble.appendChild(likeHeart)

      // Update status to "sent" after a short delay
      if (msg.sendingStatus === 'sending') {
        setTimeout(() => {
          const statusSpan = messageBubble.querySelector('.message-status');
          if (statusSpan) {
            statusSpan.textContent = "✓";
            statusSpan.style.color = "#4CAF50";
          }
        }, 800)
      }

      // Touch events for swipe-to-reply and double-tap-to-like
      let tapCount = 0
      let tapTimer = null
      let startX = 0
      let startY = 0
      let currentX = 0
      let currentY = 0
      let isDragging = false

      // Long-press detection for context menu
      let holdTimer = null

      messageBubble.addEventListener("touchstart", (e) => {
        startX = e.touches[0].clientX
        startY = e.touches[0].clientY
        isDragging = false

        // Start hold timer for context menu
        holdTimer = setTimeout(() => {
          showContextMenu(e.touches[0].clientX, e.touches[0].clientY, msg)
        }, 500)
      })

      messageBubble.addEventListener("touchmove", (e) => {
        if (!startX || !startY) return

        currentX = e.touches[0].clientX
        currentY = e.touches[0].clientY

        const diffX = currentX - startX
        const diffY = currentY - startY

        // If moved significantly, cancel hold timer
        if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
          clearTimeout(holdTimer)
        }

        // Check if it's a horizontal swipe (more horizontal than vertical)
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 30) {
          isDragging = true
          e.preventDefault()
          if (diffX > 0) {
            messageBubble.style.transform = `translateX(${Math.min(diffX, 100)}px)`
            if (diffX > 50) messageBubble.classList.add("swiping")
            else messageBubble.classList.remove("swiping")
          }
        }
      })

      messageBubble.addEventListener("touchend", (e) => {
        clearTimeout(holdTimer)
        if (isDragging) {
          const diffX = currentX - startX
          if (diffX > 50) setReplyTo(msg)
          messageBubble.style.transform = ""
          messageBubble.classList.remove("swiping")
          isDragging = false
        } else {
          // Double tap like logic
        }
      })

      // For desktop double click (like)
      messageBubble.addEventListener("dblclick", () => {
        messageBubble.classList.toggle("liked")
      })

      // For desktop right-click (reply)
      messageBubble.addEventListener("contextmenu", (e) => {
        e.preventDefault()
        setReplyTo(msg)
      })

      return messageBubble
    }

    const showContextMenu = (x, y, msg) => {
      // Remove any existing menu
      const existingMenu = document.querySelector('.message-context-menu')
      if (existingMenu) existingMenu.remove()

      const menu = document.createElement('div')
      menu.className = 'message-context-menu'
      menu.style.left = `${Math.min(x, window.innerWidth - 150)}px`
      menu.style.top = `${Math.min(y, window.innerHeight - 150)}px`

      const items = [
        { label: 'Reply', icon: '💬', action: () => setReplyTo(msg) },
        { label: msg.isStarred ? 'Unstar' : 'Star', icon: '⭐', action: () => starMessage(msg._id) },
      ]

      // Only show delete for own messages
      if (msg.userId === currentUserId) {
        items.push({ label: 'Delete', icon: '🗑️', action: () => deleteMessage(msg._id), className: 'delete' })
      }

      items.forEach(item => {
        const div = document.createElement('div')
        div.className = `context-menu-item ${item.className || ''}`
        div.innerHTML = `<span>${item.icon}</span> ${item.label}`
        div.onclick = () => {
          item.action()
          menu.remove()
        }
        menu.appendChild(div)
      })

      document.body.appendChild(menu)

      // Close menu on click elsewhere
      const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
          menu.remove()
          document.removeEventListener('touchstart', closeMenu)
          document.removeEventListener('click', closeMenu)
        }
      }
      setTimeout(() => {
        document.addEventListener('touchstart', closeMenu)
        document.addEventListener('click', closeMenu)
      }, 100)
    }

    const starMessage = async (messageId) => {
      try {
        await fetch(`/api/messages/${messageId}/star`, { method: 'POST' })
        fetchMessages() // Refresh
      } catch (error) { console.error(error) }
    }

    const deleteMessage = async (messageId) => {
      if (confirm('Delete this message?')) {
        try {
          await fetch(`/api/messages/${messageId}`, { method: 'DELETE' })
          fetchMessages() // Refresh
        } catch (error) { console.error(error) }
      }
    }

    const setReplyTo = (msg) => {
      replyingTo = {
        _id: msg._id,
        username: msg.username,
        content: msg.content,
      }

      replyUsername.textContent = msg.username
      replyMessage.textContent = msg.content
      replyPreview.style.display = "block"
      messageInput.focus()
    }

    const clearReply = () => {
      replyingTo = null
      replyPreview.style.display = "none"
    }

    const scrollToBottom = () => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight
    }

    const toggleScrollLock = () => {
      isScrollLocked = !isScrollLocked
      if (isScrollLocked) {
        messagesContainer.style.overflowY = "hidden"
        scrollLockToggleBtn.textContent = "↑"
        scrollToBottom()
      } else {
        messagesContainer.style.overflowY = "auto"
        scrollLockToggleBtn.textContent = "↓"
      }
      scrollToBottomBtn.style.display = isScrollLocked ? "none" : "flex"
    }

    const renderMessages = (messages) => {
      const wasAtBottom =
        messagesContainer.scrollTop + messagesContainer.clientHeight >= messagesContainer.scrollHeight - 50
      const previousMessageCount = messagesCache.length

      if (JSON.stringify(messagesCache) === JSON.stringify(messages)) {
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

      if (isScrollLocked || wasAtBottom || messages.length > previousMessageCount || previousMessageCount === 0) {
        setTimeout(() => {
          scrollToBottom()
        }, 50)
      }

      if (!isScrollLocked) {
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

        toggleScrollLock()
      } catch (error) {
        console.error("Error fetching current user/chat room:", error)
        chatRoomNameHeader.textContent = "Error Loading Chat"
      }
    }

    // Image upload handler
    const imageUpload = document.getElementById('image-upload');
    const handleImageSelect = async (file) => {
      if (file) {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
          alert('Image size should be less than 5MB');
          return;
        }

        const formData = new FormData();
        formData.append('image', file);

        try {
          const response = await fetch('/api/upload-image', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error('Image upload failed');
          }

          const data = await response.json();
          return data.imageUrl;
        } catch (error) {
          console.error('Error uploading image:', error);
          alert('Failed to upload image. Please try again.');
          return null;
        }
      }
      return null;
    };

    imageUpload.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        selectedImage = file;
        messageInput.placeholder = 'Add a caption (optional)...';
      }
    });

    // Mobile: Improved keyboard interaction
    const chatContainer = document.querySelector('.chat-container');

    // Use VisualViewport API if available for better mobile keyboard detection
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        const isKeyboardOpen = window.visualViewport.height < window.innerHeight * 0.8;
        if (isKeyboardOpen) {
          chatContainer.classList.add('is-typing');
          scrollToBottom();
        } else {
          chatContainer.classList.remove('is-typing');
        }
      });
    }

    messageInput.addEventListener('focus', () => {
      chatContainer.classList.add('is-typing');
      setTimeout(scrollToBottom, 300);
    });

    messageInput.addEventListener('blur', () => {
      // Small delay, but only if not refocusing
      setTimeout(() => {
        if (document.activeElement !== messageInput) {
          chatContainer.classList.remove('is-typing');
        }
      }, 200);
    });

    messageForm.addEventListener("submit", async (e) => {
      e.preventDefault()
      const content = messageInput.value.trim()
      if ((!content && !selectedImage) || !currentChatRoomId) return

      sendButton.disabled = true
      sendButton.classList.add('loading')

      // Prepare message data
      const messageData = {
        content: content || '📷 Image',
        replyTo: replyingTo ? replyingTo._id : null,
        messageType: 'text',
        imageData: null,
        contentType: null
      };

      let imageDataUrl = null;

      // If there's an image, process it first
      if (selectedImage) {
        // Create temp preview using FileReader
        const reader = new FileReader();
        imageDataUrl = await new Promise((resolve) => {
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(selectedImage);
        });

        // Create FormData for upload
        const formData = new FormData();
        formData.append('image', selectedImage);

        try {
          const response = await fetch('/api/upload-image', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error('Image upload failed');
          }

          const imageInfo = await response.json();
          messageData.imageData = imageInfo.imageData;
          messageData.contentType = imageInfo.contentType;
          messageData.messageType = 'image';
        } catch (error) {
          console.error('Error uploading image:', error);
          alert('Failed to upload image. Please try again.');
          sendButton.disabled = false;
          sendButton.textContent = "Send";
          return;
        }
      }

      // Create temporary message for immediate display
      const tempMessage = {
        _id: `temp-${Date.now()}`,
        userId: currentUserId,
        username: currentUsername,
        content: messageData.content,
        messageType: messageData.messageType,
        // Use the temp preview URL first, then switch to compressed version when ready
        imageData: imageDataUrl || messageData.imageData,
        timestamp: new Date().toISOString(),
        sendingStatus: 'sending',
        replyTo: replyingTo
          ? {
            _id: replyingTo._id,
            username: replyingTo.username,
            content: replyingTo.content,
          }
          : null,
      };

      // Clear input immediately for better UX
      messageInput.value = ""
      clearReply() // Clear reply after sending

      // Reset image selection if any
      if (selectedImage) {
        selectedImage = null;
        const imageUpload = document.getElementById('image-upload');
        imageUpload.value = '';
        messageInput.placeholder = 'Type your message...';
      }

      // Add message to UI immediately with sending status
      const optimisticMessageElement = createMessageBubbleElement(tempMessage);
      optimisticMessageElement.dataset.tempId = tempMessage._id;
      optimisticMessageElement.classList.add('sending');

      // Add loading dots for text messages
      const statusContainer = optimisticMessageElement.querySelector('.message-status-container');
      const loadingStatus = document.createElement('div');
      loadingStatus.classList.add('message-status');

      const loadingDots = document.createElement('div');
      loadingDots.classList.add('loading-dots');
      loadingDots.innerHTML = '<span></span><span></span><span></span>';

      loadingStatus.appendChild(loadingDots);
      statusContainer.insertBefore(loadingStatus, statusContainer.firstChild);

      // For images, add loading spinner
      if (messageData.messageType === 'image') {
        const imageContainer = optimisticMessageElement.querySelector('.message-image-container');
        if (imageContainer) {
          const loadingSpinner = document.createElement('div');
          loadingSpinner.classList.add('image-loading');
          imageContainer.appendChild(loadingSpinner);
        }
      }

      messagesContainer.appendChild(optimisticMessageElement);
      scrollToBottom();

      messageInput.focus();

      try {
        const response = await fetch(`/api/messages/${currentChatRoomId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(messageData),
        })

        if (response.status === 401 || response.status === 403) {
          window.location.href = "/chat-rooms"
          return
        }
        if (!response.ok) {
          throw new Error("Failed to send message")
        }

        // Update temporary message to show it's been sent
        const tempBubble = messagesContainer.querySelector(`[data-temp-id="${tempMessage._id}"]`)
        if (tempBubble) {
          tempBubble.classList.remove('sending');

          // Remove loading dots
          const loadingStatus = tempBubble.querySelector('.loading-dots')?.parentElement;
          if (loadingStatus) {
            const checkmark = document.createElement('span');
            checkmark.textContent = '✓';
            checkmark.style.color = '#4CAF50';
            loadingStatus.replaceWith(checkmark);
          }

          // Remove image loading spinner if present
          const loadingSpinner = tempBubble.querySelector('.image-loading');
          if (loadingSpinner) {
            loadingSpinner.remove();
          }

          // Keep the message visible for a moment before it gets replaced by the real one
          setTimeout(() => {
            tempBubble.remove();
          }, 500);
        }
      } catch (error) {
        console.error("Error sending message:", error);
        const tempBubble = messagesContainer.querySelector(`[data-temp-id="${tempMessage._id}"]`);
        if (tempBubble) {
          tempBubble.classList.remove('sending');

          // Show error state
          const loadingStatus = tempBubble.querySelector('.loading-dots')?.parentElement;
          if (loadingStatus) {
            loadingStatus.textContent = '❌ Failed to send';
            loadingStatus.style.color = 'var(--red-error)';
          }

          // Remove image loading spinner if present
          const loadingSpinner = tempBubble.querySelector('.image-loading');
          if (loadingSpinner) {
            loadingSpinner.remove();
          }

          // Remove after showing error
          setTimeout(() => {
            tempBubble.remove();
          }, 3000);
        }
      } finally {
        sendButton.disabled = false;
        sendButton.classList.remove('loading')
      }
    })

    // Cancel reply button
    cancelReplyBtn.addEventListener("click", clearReply)

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
        toggleScrollButton()
      }
    })
    scrollToBottomBtn.addEventListener("click", scrollToBottom)
    scrollLockToggleBtn.addEventListener("click", toggleScrollLock)

    // Initialize chat
    fetchCurrentUserAndChatRoom().then(() => {
      if (currentChatRoomId) {
        fetchMessages()
        setInterval(fetchMessages, 2000)
        setInterval(fetchOnlineUsers, 5000)
      }
    })
  }
})