document.addEventListener('DOMContentLoaded', () => {
    // --- Common Elements & Helpers ---
    const errorMessage = document.getElementById('error-message'); // For index.html
    const createErrorMessage = document.getElementById('create-error-message'); // For chat-rooms.html
    const joinErrorMessage = document.getElementById('join-error-message'); // For chat-rooms.html

    const displayMessage = (element, message, isError = true) => {
        if (element) {
            element.textContent = message;
            element.style.color = isError ? 'var(--red-error)' : 'var(--primary-color)';
            element.style.display = 'block';
        }
    };

    const clearMessage = (element) => {
        if (element) {
            element.textContent = '';
            element.style.display = 'none';
        }
    };

    // --- Auth Page Logic (index.html) ---
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        const authForm = document.getElementById('auth-form');
        const authTitle = document.getElementById('auth-title');
        const authDescription = document.getElementById('auth-description');
        const authButton = document.getElementById('auth-button');
        const switchText = document.getElementById('switch-text');
        const switchButton = document.getElementById('switch-button');

        let isLoginMode = true; // Default to login

        const updateAuthMode = () => {
            if (isLoginMode) {
                authTitle.textContent = 'Login';
                authDescription.textContent = 'Enter your credentials to access your chat.';
                authButton.textContent = 'Login';
                switchText.textContent = "Don't have an account?";
                switchButton.textContent = 'Register';
            } else {
                authTitle.textContent = 'Register';
                authDescription.textContent = 'Create a new account to start chatting.';
                authButton.textContent = 'Register';
                switchText.textContent = 'Already have an account?';
                switchButton.textContent = 'Login';
            }
            clearMessage(errorMessage);
        };

        switchButton.addEventListener('click', () => {
            isLoginMode = !isLoginMode;
            updateAuthMode();
        });

        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearMessage(errorMessage);

            const username = authForm.username.value;
            const pin = authForm.pin.value;

            authButton.disabled = true;
            authButton.textContent = isLoginMode ? 'Logging in...' : 'Registering...';

            const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';

            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, pin }),
                });

                const data = await response.json();

                if (response.ok) {
                    displayMessage(errorMessage, data.message, false); // Success message
                    setTimeout(() => {
                        window.location.href = data.redirect;
                    }, 1000);
                } else {
                    displayMessage(errorMessage, data.message || 'An unexpected error occurred.');
                }
            } catch (error) {
                console.error('Fetch error:', error);
                displayMessage(errorMessage, 'Network error. Please try again.');
            } finally {
                authButton.disabled = false;
                authButton.textContent = isLoginMode ? 'Login' : 'Register';
            }
        });

        updateAuthMode(); // Initialize UI based on default mode
    }

    // --- Chat Rooms Page Logic (chat-rooms.html) ---
    if (window.location.pathname === '/chat-rooms' || window.location.pathname === '/chat-rooms.html') {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');
        const createChatForm = document.getElementById('create-chat-form');
        const joinChatForm = document.getElementById('join-chat-form');
        const createChatButton = document.getElementById('create-chat-button');
        const joinChatButton = document.getElementById('join-chat-button');
        const logoutButton = document.getElementById('logout-button');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                button.classList.add('active');
                document.getElementById(`${button.dataset.tab}-chat-form`).classList.add('active');
                clearMessage(createErrorMessage);
                clearMessage(joinErrorMessage);
            });
        });

        createChatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearMessage(createErrorMessage);

            const name = createChatForm['create-chat-name'].value;
            const pin = createChatForm['create-chat-pin'].value;

            createChatButton.disabled = true;
            createChatButton.textContent = 'Creating...';

            try {
                const response = await fetch('/api/chatrooms/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, pin }),
                });
                const data = await response.json();

                if (response.ok) {
                    displayMessage(createErrorMessage, data.message, false);
                    setTimeout(() => { window.location.href = data.redirect; }, 1000);
                } else {
                    displayMessage(createErrorMessage, data.message || 'Failed to create chat room.');
                }
            } catch (error) {
                console.error('Create chat error:', error);
                displayMessage(createErrorMessage, 'Network error. Please try again.');
            } finally {
                createChatButton.disabled = false;
                createChatButton.textContent = 'Create & Join Chat';
            }
        });

        joinChatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearMessage(joinErrorMessage);

            const name = joinChatForm['join-chat-name'].value;
            const pin = joinChatForm['join-chat-pin'].value;

            joinChatButton.disabled = true;
            joinChatButton.textContent = 'Joining...';

            try {
                const response = await fetch('/api/chatrooms/join', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, pin }),
                });
                const data = await response.json();

                if (response.ok) {
                    displayMessage(joinErrorMessage, data.message, false);
                    setTimeout(() => { window.location.href = data.redirect; }, 1000);
                } else {
                    displayMessage(joinErrorMessage, data.message || 'Failed to join chat room.');
                }
            } catch (error) {
                console.error('Join chat error:', error);
                displayMessage(joinErrorMessage, 'Network error. Please try again.');
            } finally {
                joinChatButton.disabled = false;
                joinChatButton.textContent = 'Join Chat';
            }
        });

        logoutButton.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/auth/logout', { method: 'POST' });
                const data = await response.json();
                if (response.ok) {
                    window.location.href = data.redirect;
                } else {
                    console.error('Logout failed:', data.message);
                    alert('Failed to logout. Please try again.');
                }
            } catch (error) {
                console.error('Logout fetch error:', error);
                alert('Network error during logout. Please try again.');
            }
        });
    }

    // --- Chat Page Logic (chat.html) ---
    if (window.location.pathname === '/chat' || window.location.pathname === '/chat.html') {
        const chatRoomNameHeader = document.getElementById('chat-room-name');
        const logoutButton = document.getElementById('logout-button');
        const leaveChatButton = document.getElementById('leave-chat-button');
        const messagesContainer = document.getElementById('messages-container');
        const messageForm = document.getElementById('message-form');
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-button');

        let currentUserId = null;
        let currentUsername = '';
        let currentChatRoomId = null;
        let messagesCache = []; // To store messages and prevent re-rendering identical lists

        // Helper function to create a single message bubble element
        const createMessageBubbleElement = (msg) => {
            const messageBubble = document.createElement('div');
            messageBubble.classList.add('message-bubble');
            messageBubble.classList.add(msg.userId === currentUserId ? 'sent' : 'received');

            const usernameSpan = document.createElement('div');
            usernameSpan.classList.add('message-username');
            usernameSpan.textContent = msg.username;

            const contentP = document.createElement('p');
            contentP.classList.add('message-content');
            contentP.textContent = msg.content;

            const timestampSpan = document.createElement('div');
            timestampSpan.classList.add('message-timestamp');
            const date = new Date(msg.timestamp);
            timestampSpan.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            messageBubble.appendChild(usernameSpan);
            messageBubble.appendChild(contentP);
            messageBubble.appendChild(timestampSpan);
            return messageBubble;
        };

        // Function to render all messages
        const renderMessages = (messages) => {
            // Check if messages have actually changed to avoid unnecessary re-renders
            // This is a simple check, for complex apps, a more robust diffing might be needed
            if (JSON.stringify(messagesCache) === JSON.stringify(messages)) {
                return;
            }
            messagesCache = messages; // Update cache

            messagesContainer.innerHTML = ''; // Clear existing messages
            if (messages.length === 0) {
                messagesContainer.innerHTML = '<div class="text-center text-gray-500 py-10">No messages yet. Start the conversation!</div>';
                return;
            }

            messages.forEach(msg => {
                const messageElement = createMessageBubbleElement(msg);
                messagesContainer.appendChild(messageElement);
            });

            // Scroll to bottom ONLY ONCE after all messages are added
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        };

        // Function to fetch messages from the server
        const fetchMessages = async () => {
            if (!currentChatRoomId) return; // Don't fetch if no room is selected

            try {
                const response = await fetch(`/api/messages/${currentChatRoomId}`);
                if (response.status === 401 || response.status === 403) {
                    window.location.href = '/chat-rooms'; // Redirect if unauthorized or access denied
                    return;
                }
                if (!response.ok) {
                    throw new Error('Failed to fetch messages');
                }
                const data = await response.json();
                renderMessages(data.messages);
            } catch (error) {
                console.error('Error fetching messages:', error);
                // Optionally display an error message to the user
            }
        };

        // Function to fetch current user and chat room details
        const fetchCurrentUserAndChatRoom = async () => {
            try {
                const response = await fetch('/api/user/me');
                if (response.status === 401) {
                    window.location.href = '/'; // Redirect to login if unauthorized
                    return;
                }
                if (!response.ok) {
                    throw new Error('Failed to fetch current user/chat room');
                }
                const data = await response.json();
                currentUserId = data.userId;
                currentUsername = data.username;
                currentChatRoomId = data.currentChatRoomId;

                if (!currentChatRoomId) {
                    window.location.href = '/chat-rooms'; // Redirect if no chat room selected
                    return;
                }
                chatRoomNameHeader.textContent = data.currentChatRoomName || 'Chat Room';

            } catch (error) {
                console.error('Error fetching current user/chat room:', error);
                chatRoomNameHeader.textContent = 'Error Loading Chat'; // Fallback message
            }
        };

        // Event listener for sending messages
        messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = messageInput.value.trim();
            if (!content || !currentChatRoomId) return;

            sendButton.disabled = true;
            sendButton.textContent = 'Sending...';

            // --- Optimistic Update ---
            const tempMessage = {
                _id: `temp-${Date.now()}`, // Unique temporary ID for optimistic message
                userId: currentUserId,
                username: currentUsername,
                content: content,
                timestamp: new Date().toISOString(),
            };
            const optimisticMessageElement = createMessageBubbleElement(tempMessage);
            optimisticMessageElement.dataset.tempId = tempMessage._id; // Mark optimistic message
            messagesContainer.appendChild(optimisticMessageElement);
            messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to bottom after optimistic add

            messageInput.value = ''; // Clear input field

            try {
                const response = await fetch(`/api/messages/${currentChatRoomId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ content }),
                });

                if (response.status === 401 || response.status === 403) {
                    window.location.href = '/chat-rooms'; // Redirect if unauthorized or access denied
                    return;
                }
                if (!response.ok) {
                    throw new Error('Failed to send message');
                }
                // Message sent successfully. The next poll will fetch the real message
                // and renderMessages will update the UI, replacing the temporary one.
            } catch (error) {
                console.error('Error sending message:', error);
                // If sending fails, remove the optimistic message from UI
                const tempBubble = messagesContainer.querySelector(`[data-temp-id="${tempMessage._id}"]`);
                if (tempBubble) {
                    tempBubble.remove();
                }
                // Optionally, display an error message to the user
            } finally {
                sendButton.disabled = false;
                sendButton.textContent = 'Send';
            }
        });

        // Event listener for logout button
        logoutButton.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/auth/logout', { method: 'POST' });
                const data = await response.json();
                if (response.ok) {
                    window.location.href = data.redirect;
                } else {
                    console.error('Logout failed:', data.message);
                    alert('Failed to logout. Please try again.');
                }
            } catch (error) {
                console.error('Logout fetch error:', error);
                alert('Network error during logout. Please try again.');
            }
        });

        // Event listener for leave chat button
        leaveChatButton.addEventListener('click', async () => {
            // To "leave" a chat, we simply clear the currentChatRoomId from the session
            // and redirect to the chat rooms page.
            // A more robust solution would involve a server-side endpoint to remove the user
            // from the chat room's participants list. For simplicity, we'll just clear session.
            try {
                // We can't directly clear currentChatRoomId from session without a dedicated endpoint.
                // For now, we'll redirect to chat-rooms, which will effectively "leave" the room
                // by not having a currentChatRoomId in the session for the next page load.
                // If you want to truly remove from server-side session, you'd need a new API route.
                window.location.href = '/chat-rooms';
            } catch (error) {
                console.error('Leave chat error:', error);
                alert('Failed to leave chat. Please try again.');
            }
        });


        // Initial setup for chat page: Fetch user/chat room, then messages, then start polling
        fetchCurrentUserAndChatRoom().then(() => {
            if (currentChatRoomId) {
                fetchMessages();
                setInterval(fetchMessages, 2000); // Poll every 2 seconds for new messages
            }
        });
    }
});
