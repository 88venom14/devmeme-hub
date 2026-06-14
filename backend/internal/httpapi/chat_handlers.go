package httpapi

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

type createConversationRequest struct {
	Title *string `json:"title"`
}

type createMessageRequest struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func (s *Server) listChatConversations(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(), `
		SELECT id::text, user_id::text, title, created_at, updated_at
		FROM chat_conversations
		WHERE user_id = $1
		ORDER BY updated_at DESC
	`, mustUser(r).ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list conversations")
		return
	}
	defer rows.Close()

	items := make([]ChatConversation, 0)
	for rows.Next() {
		var item ChatConversation
		if err := rows.Scan(&item.ID, &item.UserID, &item.Title, &item.CreatedAt, &item.UpdatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "could not scan conversation")
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "could not list conversations")
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) createChatConversation(w http.ResponseWriter, r *http.Request) {
	var req createConversationRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	title := "New chat"
	if req.Title != nil && *req.Title != "" {
		title = *req.Title
	}
	var item ChatConversation
	err := s.db.QueryRow(r.Context(), `
		INSERT INTO chat_conversations (user_id, title)
		VALUES ($1, $2)
		RETURNING id::text, user_id::text, title, created_at, updated_at
	`, mustUser(r).ID, title).Scan(&item.ID, &item.UserID, &item.Title, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create conversation")
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) deleteChatConversation(w http.ResponseWriter, r *http.Request) {
	tag, err := s.db.Exec(r.Context(), `DELETE FROM chat_conversations WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "conversationID"), mustUser(r).ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not delete conversation")
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "conversation not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listChatMessages(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(), `
		SELECT m.id::text, m.conversation_id::text, m.user_id::text, m.role, m.content, m.created_at
		FROM chat_messages m
		JOIN chat_conversations c ON c.id = m.conversation_id
		WHERE m.conversation_id = $1 AND c.user_id = $2
		ORDER BY m.created_at ASC
	`, chi.URLParam(r, "conversationID"), mustUser(r).ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list messages")
		return
	}
	defer rows.Close()

	items := make([]ChatMessage, 0)
	for rows.Next() {
		var item ChatMessage
		if err := rows.Scan(&item.ID, &item.ConversationID, &item.UserID, &item.Role, &item.Content, &item.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "could not scan message")
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "could not list messages")
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) createChatMessage(w http.ResponseWriter, r *http.Request) {
	var req createMessageRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.Role != "user" && req.Role != "assistant" {
		writeError(w, http.StatusBadRequest, "role must be user or assistant")
		return
	}
	if req.Content == "" {
		writeError(w, http.StatusBadRequest, "content is required")
		return
	}

	var item ChatMessage
	err := s.db.QueryRow(r.Context(), `
		WITH owned_conversation AS (
			SELECT id FROM chat_conversations WHERE id = $1 AND user_id = $2
		), inserted AS (
			INSERT INTO chat_messages (conversation_id, user_id, role, content)
			SELECT id, $2, $3, $4 FROM owned_conversation
			RETURNING id, conversation_id, user_id, role, content, created_at
		)
		UPDATE chat_conversations
		SET updated_at = NOW()
		WHERE id = $1 AND user_id = $2
		RETURNING (
			SELECT id::text FROM inserted
		), (
			SELECT conversation_id::text FROM inserted
		), (
			SELECT user_id::text FROM inserted
		), (
			SELECT role FROM inserted
		), (
			SELECT content FROM inserted
		), (
			SELECT created_at FROM inserted
		)
	`, chi.URLParam(r, "conversationID"), mustUser(r).ID, req.Role, req.Content).Scan(
		&item.ID, &item.ConversationID, &item.UserID, &item.Role, &item.Content, &item.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "conversation not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create message")
		return
	}
	writeJSON(w, http.StatusCreated, item)
}
