Create an AI chat feature for a web application (similar to devMeme — dark theme, card-based UI, as shown in the provided screenshot).

### 📍 Website context:
- The website is a feed of posts (card layout)
- On the right side there is a sidebar with:
  - user profile
  - popular tags (important!)
- UI is minimalistic, dark (black/dark brown), with soft shadows and rounded corners

---

# 🧩 TASK

## 1. Embedded chat in the sidebar

Add an AI chat widget BELOW the "Popular Tags" section.

### Requirements:
- The chat should look like a compact widget
- Fixed height (~300–400px)
- Internal scroll
- Input field at the bottom
- Send button or Enter key support

### UI:
- User messages aligned to the right
- AI (Fluttershy) messages aligned to the left
- Fluttershy avatar for AI messages
- Styling must match the existing dark theme

---

## 2. Character

The AI must act as a character:

Fluttershy:
- very kind
- gentle
- slightly shy
- speaks softly and politely
- sometimes uses "..." or phrases like "if you don't mind"

### System prompt:
"You are Fluttershy — a very gentle, kind, and slightly shy character. You speak softly, politely, and with care. Sometimes you hesitate and try to support the user while avoiding any aggression."

---

## 3. Message history

Implement persistent chat history:

- Each message is stored in the database (Supabase)
- History is loaded when the chat opens
- Limit: last 20–30 messages

---

## 4. Separate chat page / tab

Add a new tab in the navigation (next to "Feed", "Profile"):

### Name:
"Chat"

### Page functionality:
- Fullscreen chat interface
- Message history
- More comfortable UI (messenger-like)
- Ability to continue conversations

---

## 5. Chat history (extended feature)

(Optional but recommended)

Add multiple conversations support:

- Left panel: list of chats
- Right panel: active chat
- "New Chat" button

---

## 6. Technical implementation

### Frontend:
- HTML / JavaScript (or React if used)
- fetch → Supabase Edge Function

### Backend:
- Supabase Edge Function

### Database:
Table: messages
- id
- user_id
- role (user / assistant)
- content
- created_at

---

## 7. UX details

- Auto-scroll to bottom
- "Typing..." loader
- Disable button while sending
- Clear input after sending

---

## 8. Security

- OpenAI API key must be stored only on the server (Supabase function)
- user_id stored in localStorage

---

## 9. Additional (optional)

- Message animation
- Typing effect
- Fluttershy avatar

---

# 🎯 GOAL

Build an AI chat with the Fluttershy character:
- embedded in the sidebar (mini widget)
- plus a full chat page
- with persistent history
- fully matching the website style