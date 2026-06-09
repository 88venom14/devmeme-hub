package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"devmeme-hub/backend/internal/config"
	"devmeme-hub/backend/internal/migrations"

	"github.com/jackc/pgx/v5"
)

type row map[string]any

func main() {
	backupDir := os.Getenv("BACKUP_DIR")
	if backupDir == "" {
		backupDir = filepath.Join("..", "backups", "devmeme_supabase_jsonl")
	}

	databaseURL, err := config.DatabaseURL()
	if err != nil {
		slog.Error("load database url", "error", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	conn, err := pgx.Connect(ctx, databaseURL)
	if err != nil {
		slog.Error("connect database", "error", err)
		os.Exit(1)
	}
	defer conn.Close(context.Background())

	if err := migrations.Up(ctx, conn); err != nil {
		slog.Error("apply migrations", "error", err)
		os.Exit(1)
	}

	tx, err := conn.Begin(ctx)
	if err != nil {
		slog.Error("begin import", "error", err)
		os.Exit(1)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		TRUNCATE
			chat_messages,
			chat_conversations,
			user_activity,
			saved_posts,
			post_tags,
			tags,
			follows,
			stars,
			comments,
			posts,
			profiles,
			user_sessions,
			auth_identities,
			users
		RESTART IDENTITY CASCADE
	`); err != nil {
		slog.Error("truncate database", "error", err)
		os.Exit(1)
	}

	imports := []struct {
		file string
		fn   func(context.Context, pgx.Tx, row) error
	}{
		{"auth_users.jsonl", insertUser},
		{"public_profiles.jsonl", insertProfile},
		{"public_posts.jsonl", insertPost},
		{"public_comments.jsonl", insertComment},
		{"public_stars.jsonl", insertStar},
		{"public_follows.jsonl", insertFollow},
		{"public_tags.jsonl", insertTag},
		{"public_post_tags.jsonl", insertPostTag},
		{"public_saved_posts.jsonl", insertSavedPost},
		{"public_user_activity.jsonl", insertUserActivity},
		{"public_chat_conversations.jsonl", insertChatConversation},
		{"public_chat_messages.jsonl", insertChatMessage},
	}

	for _, item := range imports {
		count, err := importFile(ctx, tx, filepath.Join(backupDir, item.file), item.fn)
		if err != nil {
			slog.Error("import file", "file", item.file, "error", err)
			os.Exit(1)
		}
		slog.Info("imported", "file", item.file, "rows", count)
	}

	if err := tx.Commit(ctx); err != nil {
		slog.Error("commit import", "error", err)
		os.Exit(1)
	}

	slog.Info("backup import complete")
}

func importFile(ctx context.Context, tx pgx.Tx, path string, insert func(context.Context, pgx.Tx, row) error) (int, error) {
	file, err := os.Open(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) && filepath.Base(path) == "public_user_activity.jsonl" {
			return 0, nil
		}
		return 0, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	buf := make([]byte, 1024*1024)
	scanner.Buffer(buf, 64*1024*1024)

	count := 0
	for scanner.Scan() {
		line := bytes.TrimPrefix(scanner.Bytes(), []byte{0xef, 0xbb, 0xbf})
		if len(line) == 0 {
			continue
		}
		var data row
		if err := json.Unmarshal(line, &data); err != nil {
			return count, err
		}
		if err := insert(ctx, tx, data); err != nil {
			return count, err
		}
		count++
	}
	return count, scanner.Err()
}

func insertUser(ctx context.Context, tx pgx.Tx, r row) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO users (id, email, password_hash, status, email_verified_at, last_login_at, metadata, created_at, updated_at)
		VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8)
	`, r["id"], r["email"], r["encrypted_password"], r["email_confirmed_at"], r["last_sign_in_at"],
		jsonObject(r["raw_user_meta_data"]), r["created_at"], r["updated_at"])
	return err
}

func insertProfile(ctx context.Context, tx pgx.Tx, r row) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO profiles (id, username, display_name, avatar_url, bio, website_url, github_url, youtube_url, twitch_url, banner_url, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`, r["id"], r["username"], r["display_name"], r["avatar_url"], r["bio"], r["website_url"], r["github_url"],
		r["youtube_url"], r["twitch_url"], r["banner_url"], r["created_at"], r["updated_at"])
	return err
}

func insertPost(ctx context.Context, tx pgx.Tx, r row) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO posts (id, user_id, title, description, content_md, image_url, video_url, github_url, github_repo_json, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`, r["id"], r["user_id"], r["title"], r["description"], r["content_md"], r["image_url"], r["video_url"],
		r["github_url"], jsonObject(r["github_repo_json"]), r["created_at"], r["updated_at"])
	return err
}

func insertComment(ctx context.Context, tx pgx.Tx, r row) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO comments (id, post_id, user_id, parent_id, text, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, r["id"], r["post_id"], r["user_id"], r["parent_id"], r["text"], r["created_at"], r["updated_at"])
	return err
}

func insertStar(ctx context.Context, tx pgx.Tx, r row) error {
	_, err := tx.Exec(ctx, `INSERT INTO stars (id, post_id, user_id, created_at) VALUES ($1, $2, $3, $4)`,
		r["id"], r["post_id"], r["user_id"], r["created_at"])
	return err
}

func insertFollow(ctx context.Context, tx pgx.Tx, r row) error {
	_, err := tx.Exec(ctx, `INSERT INTO follows (id, follower_id, following_id, created_at) VALUES ($1, $2, $3, $4)`,
		r["id"], r["follower_id"], r["following_id"], r["created_at"])
	return err
}

func insertTag(ctx context.Context, tx pgx.Tx, r row) error {
	_, err := tx.Exec(ctx, `INSERT INTO tags (id, name, created_at) VALUES ($1, $2, $3)`,
		r["id"], r["name"], r["created_at"])
	return err
}

func insertPostTag(ctx context.Context, tx pgx.Tx, r row) error {
	_, err := tx.Exec(ctx, `INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2)`,
		r["post_id"], r["tag_id"])
	return err
}

func insertSavedPost(ctx context.Context, tx pgx.Tx, r row) error {
	_, err := tx.Exec(ctx, `INSERT INTO saved_posts (id, user_id, post_id, created_at) VALUES ($1, $2, $3, $4)`,
		r["id"], r["user_id"], r["post_id"], r["created_at"])
	return err
}

func insertUserActivity(ctx context.Context, tx pgx.Tx, r row) error {
	_, err := tx.Exec(ctx, `INSERT INTO user_activity (id, user_id, activity_type, metadata, created_at) VALUES ($1, $2, $3, $4, $5)`,
		r["id"], r["user_id"], r["activity_type"], jsonObject(r["metadata"]), r["created_at"])
	return err
}

func insertChatConversation(ctx context.Context, tx pgx.Tx, r row) error {
	_, err := tx.Exec(ctx, `INSERT INTO chat_conversations (id, user_id, title, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
		r["id"], r["user_id"], r["title"], r["created_at"], r["updated_at"])
	return err
}

func insertChatMessage(ctx context.Context, tx pgx.Tx, r row) error {
	_, err := tx.Exec(ctx, `INSERT INTO chat_messages (id, conversation_id, user_id, role, content, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
		r["id"], r["conversation_id"], r["user_id"], r["role"], r["content"], r["created_at"])
	return err
}

func jsonObject(value any) any {
	if value == nil {
		return nil
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return nil
	}
	return raw
}
