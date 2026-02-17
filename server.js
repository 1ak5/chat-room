require("dotenv").config() // Load environment variables from .env file
const express = require("express")
const session = require("express-session")
const path = require("path")
const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
const multer = require("multer")
const sharp = require("sharp")
const fs = require("fs")

const app = express()
const PORT = process.env.PORT || 3000

// Configure multer for optimized image uploads
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed!'))
    }
  }
})

// --- MongoDB Connection ---
const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  console.error("Error: MONGODB_URI environment variable is not defined.")
  process.exit(1) // Exit the process if URI is missing
}

const dbConnect = async () => {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log("MongoDB connected successfully!")
  } catch (error) {
    console.error("MongoDB connection error:", error)
    process.exit(1) // Exit the process on connection failure
  }
}

// Connect to MongoDB
dbConnect()

// --- Mongoose Schemas and Models ---
const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    hashedPin: {
      type: String,
      required: true,
    },
    lastActive: {
      // New field for online status tracking
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
)
const User = mongoose.model("User", UserSchema)

const ChatRoomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    hashedPin: {
      type: String,
      required: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
)
const ChatRoom = mongoose.model("ChatRoom", ChatRoomSchema)

const MessageSchema = new mongoose.Schema(
  {
    chatRoomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    messageType: {
      type: String,
      enum: ['text', 'image'],
      default: 'text'
    },
    image: {
      data: Buffer,
      contentType: String,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
)
const Message = mongoose.model("Message", MessageSchema)

// --- Express Middleware ---
app.use(express.json()) // For parsing application/json
app.use(express.urlencoded({ extended: true })) // For parsing application/x-www-form-urlencoded

// Session middleware with better configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiration on activity
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
    proxy: true,
  }),
)

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")))

// --- Authentication Middleware ---
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    next()
  } else {
    res.redirect("/") // Redirect to login/register if not authenticated
  }
}

// Middleware to update lastActive timestamp for authenticated users
const updateLastActive = async (req, res, next) => {
  if (req.session.userId) {
    try {
      await User.findByIdAndUpdate(req.session.userId, { lastActive: new Date() })
    } catch (error) {
      console.error("Error updating lastActive:", error)
    }
  }
  next()
}
app.use(updateLastActive) // Apply this middleware to all routes after session

// Configure multer for optimized image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Image upload and processing endpoint
app.post('/api/upload-image', isAuthenticated, imageUpload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No image file uploaded' });
  }

  try {
    let processedBuffer;
    
    // Check if image is already small enough (under 200KB)
    if (req.file.size <= 200 * 1024) {
      processedBuffer = req.file.buffer;
    } else {
      const pipeline = sharp(req.file.buffer);
      const metadata = await pipeline.metadata();
      
      // Determine optimal compression settings
      let width = metadata.width;
      let quality = 80;
      
      if (req.file.size > 2 * 1024 * 1024) { // > 2MB
        width = Math.min(metadata.width, 1024);
        quality = 60;
      } else if (req.file.size > 1024 * 1024) { // > 1MB
        width = Math.min(metadata.width, 1200);
        quality = 70;
      } else if (req.file.size > 500 * 1024) { // > 500KB
        width = Math.min(metadata.width, 1500);
        quality = 75;
      }
      
      // Fast compression pipeline
      processedBuffer = await pipeline
        .resize(width, null, { 
          fastShrinkOnLoad: true,
          kernel: sharp.kernel.nearest // Faster resizing
        })
        .jpeg({ 
          quality,
          mozjpeg: true,
          optimizeScans: true,
          chromaSubsampling: '4:2:0',
          trellisQuantisation: true,
          overshootDeringing: true,
          optimizeCoding: true,
          quantisationTable: 3
        })
        .toBuffer();
    }

    // Convert to base64 and send response immediately
    const base64Image = `data:image/jpeg;base64,${processedBuffer.toString('base64')}`;
    return res.json({ 
      success: true, 
      imageData: base64Image,
      contentType: 'image/jpeg'
    });
  } catch (error) {
    console.error('Error processing image:', error);
    return res.status(500).json({ message: 'Error processing image' });
  }
});

// --- Routes ---

// Register route
app.post("/api/auth/register", async (req, res) => {
  const { username, pin } = req.body

  if (!username || !pin || username.length < 3 || pin.length < 4) {
    return res.status(400).json({ message: "Username must be at least 3 characters and PIN at least 4 characters." })
  }

  try {
    const existingUser = await User.findOne({ username })
    if (existingUser) {
      return res.status(409).json({ message: "Username already exists. Please choose a different one." })
    }

    const hashedPin = await bcrypt.hash(pin, 10)
    const newUser = new User({ username, hashedPin })
    await newUser.save()

    // Properly set session
    req.session.userId = newUser._id.toString()
    req.session.username = newUser.username

    // Save session explicitly
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err)
        return res.status(500).json({ message: "Failed to save session." })
      }
      res.status(201).json({ message: "Registration successful!", redirect: "/chat-rooms" })
    })
  } catch (error) {
    console.error("Registration error:", error)
    res.status(500).json({ message: "Failed to register. Please try again." })
  }
})

// Login route
app.post("/api/auth/login", async (req, res) => {
  const { username, pin } = req.body

  if (!username || !pin) {
    return res.status(400).json({ message: "Username and PIN are required." })
  }

  try {
    const user = await User.findOne({ username })
    if (!user) {
      return res.status(401).json({ message: "Invalid username or PIN." })
    }

    const isPinValid = await bcrypt.compare(pin, user.hashedPin)
    if (!isPinValid) {
      return res.status(401).json({ message: "Invalid username or PIN." })
    }

    // Properly set session
    req.session.userId = user._id.toString()
    req.session.username = user.username

    // Save session explicitly
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err)
        return res.status(500).json({ message: "Failed to save session." })
      }
      res.status(200).json({ message: "Login successful!", redirect: "/chat-rooms" })
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({ message: "Failed to login. Please try again." })
  }
})

// Logout route
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err)
      return res.status(500).json({ message: "Failed to logout." })
    }
    res.status(200).json({ message: "Logged out successfully!", redirect: "/" })
  })
})

// Get current user and chat room details (new/updated route)
app.get("/api/user/me", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select("username").lean()
    if (!user) {
      req.session.destroy(() => res.status(401).json({ message: "User not found, please log in again." }))
      return
    }
    res.status(200).json({
      userId: user._id,
      username: user.username,
      currentChatRoomId: req.session.currentChatRoomId || null,
      currentChatRoomName: req.session.currentChatRoomName || null,
    })
  } catch (error) {
    console.error("Error fetching user/session data:", error)
    res.status(500).json({ message: "Failed to fetch user data." })
  }
})

// Create Chat Room
app.post("/api/chatrooms/create", isAuthenticated, async (req, res) => {
  const { name, pin } = req.body
  const userId = req.session.userId

  if (!name || !pin || name.length < 3 || pin.length < 4) {
    return res.status(400).json({ message: "Chat name must be at least 3 characters and PIN at least 4 characters." })
  }

  try {
    const existingRoom = await ChatRoom.findOne({ name })
    if (existingRoom) {
      return res.status(409).json({ message: "Chat room with this name already exists." })
    }

    const hashedPin = await bcrypt.hash(pin, 10)
    const newRoom = new ChatRoom({ name, hashedPin, participants: [userId] })
    await newRoom.save()

    req.session.currentChatRoomId = newRoom._id.toString()
    req.session.currentChatRoomName = newRoom.name

    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err)
        return res.status(500).json({ message: "Failed to save session." })
      }
      res.status(201).json({ message: "Chat room created and joined!", redirect: "/chat" })
    })
  } catch (error) {
    console.error("Error creating chat room:", error)
    res.status(500).json({ message: "Failed to create chat room." })
  }
})

// Join Chat Room
app.post("/api/chatrooms/join", isAuthenticated, async (req, res) => {
  const { name, pin } = req.body
  const userId = req.session.userId

  if (!name || !pin) {
    return res.status(400).json({ message: "Chat name and PIN are required." })
  }

  try {
    const room = await ChatRoom.findOne({ name })
    if (!room) {
      return res.status(404).json({ message: "Chat room not found." })
    }

    const isPinValid = await bcrypt.compare(pin, room.hashedPin)
    if (!isPinValid) {
      return res.status(401).json({ message: "Invalid PIN for this chat room." })
    }

    // Add user to participants if not already there
    if (!room.participants.includes(userId)) {
      room.participants.push(userId)
      await room.save()
    }

    req.session.currentChatRoomId = room._id.toString()
    req.session.currentChatRoomName = room.name

    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err)
        return res.status(500).json({ message: "Failed to save session." })
      }
      res.status(200).json({ message: "Joined chat room!", redirect: "/chat" })
    })
  } catch (error) {
    console.error("Error joining chat room:", error)
    res.status(500).json({ message: "Failed to join chat room." })
  }
})

// Get messages for a specific chat room (protected) - UPDATED WITH REPLY SUPPORT
app.get("/api/messages/:chatRoomId", isAuthenticated, async (req, res) => {
  const { chatRoomId } = req.params
  const userId = req.session.userId

  try {
    // Verify user is a participant of this chat room
    const room = await ChatRoom.findById(chatRoomId)
    if (!room || !room.participants.includes(userId)) {
      return res.status(403).json({ message: "Access denied to this chat room." })
    }

    const messages = await Message.find({ chatRoomId })
      .populate("userId", "username") // Populate username from User model
      .populate({
        path: "replyTo",
        populate: {
          path: "userId",
          select: "username",
        },
      }) // Populate reply message with user details
      .sort({ timestamp: 1 })
      .lean()

    const messagesFormatted = messages.map((msg) => {
      const formattedMsg = {
        _id: msg._id.toString(),
        chatRoomId: msg.chatRoomId.toString(),
        userId: msg.userId._id.toString(),
        username: msg.userId.username,
        content: msg.content,
        timestamp: msg.timestamp,
        messageType: msg.messageType || 'text',
        replyTo: msg.replyTo
          ? {
              _id: msg.replyTo._id.toString(),
              username: msg.replyTo.userId.username,
              content: msg.replyTo.content,
            }
          : null,
      };

      // If message has image, convert buffer to base64
      if (msg.image && msg.image.data) {
        formattedMsg.imageData = `data:${msg.image.contentType};base64,${msg.image.data.toString('base64')}`;
      }

      return formattedMsg;
    })

    res.status(200).json({ messages: messagesFormatted })
  } catch (error) {
    console.error("Error fetching messages:", error)
    res.status(500).json({ message: "Failed to fetch messages." })
  }
})

// Send message to a specific chat room (protected) - UPDATED WITH IMAGE AND REPLY SUPPORT
app.post("/api/messages/:chatRoomId", isAuthenticated, async (req, res) => {
  const { chatRoomId } = req.params
  const { content, replyTo, messageType, imageData, contentType } = req.body
  const userId = req.session.userId

  if ((!content || content.trim() === "") && !imageData) {
    return res.status(400).json({ message: "Message content or image is required." })
  }

  try {
    // Verify user is a participant of this chat room
    const room = await ChatRoom.findById(chatRoomId)
    if (!room || !room.participants.includes(userId)) {
      return res.status(403).json({ message: "Access denied to this chat room." })
    }

    const messageData = {
      chatRoomId,
      userId,
      content: content.trim(),
      messageType: messageType || 'text',
    }

    // If image data is present, store it in the message
    if (imageData && contentType) {
      // Convert base64 to buffer
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      messageData.image = {
        data: buffer,
        contentType: contentType
      }
      messageData.messageType = 'image';
    }

    // Add replyTo if provided and valid
    if (replyTo) {
      const replyMessage = await Message.findById(replyTo)
      if (replyMessage && replyMessage.chatRoomId.toString() === chatRoomId) {
        messageData.replyTo = replyTo
      }
    }

    const newMessage = new Message(messageData)
    await newMessage.save()

    // Return the populated message for optimistic update
    const populatedMessage = await Message.findById(newMessage._id)
      .populate("userId", "username")
      .populate({
        path: "replyTo",
        populate: {
          path: "userId",
          select: "username",
        },
      })
      .lean()

    const formattedMessage = {
      _id: populatedMessage._id.toString(),
      chatRoomId: populatedMessage.chatRoomId.toString(),
      userId: populatedMessage.userId._id.toString(),
      username: populatedMessage.userId.username,
      content: populatedMessage.content,
      timestamp: populatedMessage.timestamp,
      replyTo: populatedMessage.replyTo
        ? {
            _id: populatedMessage.replyTo._id.toString(),
            username: populatedMessage.replyTo.userId.username,
            content: populatedMessage.replyTo.content,
          }
        : null,
    }

    res.status(201).json({
      message: "Message sent successfully!",
      newMessage: formattedMessage,
    })
  } catch (error) {
    console.error("Error sending message:", error)
    res.status(500).json({ message: "Failed to send message." })
  }
})

// New route to get online users in a specific chat room
app.get("/api/chatrooms/:chatRoomId/online-users", isAuthenticated, async (req, res) => {
  const { chatRoomId } = req.params
  const userId = req.session.userId // Current user

  try {
    const room = await ChatRoom.findById(chatRoomId)
    if (!room || !room.participants.includes(userId)) {
      return res.status(403).json({ message: "Access denied to this chat room." })
    }

    // Define a threshold for "online" (e.g., last 15 seconds)
    const onlineThreshold = new Date(Date.now() - 15 * 1000) // 15 seconds ago

    // Find users who are participants of this room and have been active recently
    const onlineUsers = await User.find({
      _id: { $in: room.participants },
      lastActive: { $gte: onlineThreshold },
    })
      .select("username")
      .lean()

    // Filter out the current user from the list
    const filteredOnlineUsers = onlineUsers.filter((user) => user._id.toString() !== userId.toString())

    res.status(200).json({ onlineUsers: filteredOnlineUsers })
  } catch (error) {
    console.error("Error fetching online users:", error)
    res.status(500).json({ message: "Failed to fetch online users." })
  }
})

// Serve chat-rooms.html if authenticated
app.get("/chat-rooms", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "chat-rooms.html"))
})

// Serve chat.html if authenticated and in a chat room
app.get("/chat", isAuthenticated, (req, res) => {
  if (!req.session.currentChatRoomId) {
    return res.redirect("/chat-rooms") // Redirect if no chat room selected
  }
  res.sendFile(path.join(__dirname, "public", "chat.html"))
})

// Redirect root to index.html (login/register)
app.get("/", (req, res) => {
  if (req.session.userId) {
    if (req.session.currentChatRoomId) {
      res.redirect("/chat")
    } else {
      res.redirect("/chat-rooms")
    }
  } else {
    res.sendFile(path.join(__dirname, "public", "index.html"))
  }
})

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})