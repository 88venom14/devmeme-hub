package httpapi

import (
	"encoding/json"
	"time"
)

type User struct {
	ID        string          `json:"id"`
	Email     string          `json:"email"`
	Role      string          `json:"role"`
	Status    string          `json:"status"`
	Metadata  json.RawMessage `json:"metadata,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

type Profile struct {
	ID          string    `json:"id"`
	Username    string    `json:"username"`
	DisplayName *string   `json:"display_name"`
	AvatarURL   *string   `json:"avatar_url"`
	Bio         *string   `json:"bio"`
	WebsiteURL  *string   `json:"website_url"`
	GithubURL   *string   `json:"github_url"`
	YoutubeURL  *string   `json:"youtube_url"`
	TwitchURL   *string   `json:"twitch_url"`
	BannerURL   *string   `json:"banner_url"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	// IsPrivate is set on profile-view responses when the profile is
	// followers-only and the viewer is not allowed to see its full content.
	IsPrivate bool `json:"is_private,omitempty"`
	// LikedHidden is set on profile-view responses when the owner hid their
	// liked posts and the viewer is not the owner.
	LikedHidden bool `json:"liked_hidden,omitempty"`
}

type Tag struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type Post struct {
	ID             string          `json:"id"`
	UserID         string          `json:"user_id"`
	Title          string          `json:"title"`
	Description    *string         `json:"description"`
	ContentMD      *string         `json:"content_md"`
	ImageURL       *string         `json:"image_url"`
	VideoURL       *string         `json:"video_url"`
	GithubURL      *string         `json:"github_url"`
	GithubRepoJSON json.RawMessage `json:"github_repo_json,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
	Profile        Profile         `json:"profile"`
	StarCount      int64           `json:"star_count"`
	CommentCount   int64           `json:"comment_count"`
	Tags           []Tag           `json:"tags"`
}

type Comment struct {
	ID        string    `json:"id"`
	PostID    string    `json:"post_id"`
	UserID    string    `json:"user_id"`
	ParentID  *string   `json:"parent_id"`
	Text      string    `json:"text"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Profile   Profile   `json:"profile"`
}

type Game struct {
	ID              string    `json:"id"`
	Slug            string    `json:"slug"`
	AuthorID        string    `json:"author_id"`
	Title           string    `json:"title"`
	Description     *string   `json:"description"`
	ThumbnailURL    *string   `json:"thumbnail_url"`
	EntryPath       string    `json:"entry_path"`
	ArchiveSize     *int64    `json:"archive_size"`
	Status          string    `json:"status"`
	RejectionReason *string   `json:"rejection_reason"`
	PlayCount       int64     `json:"play_count"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
	Author          Profile   `json:"author"`
	Tags            []Tag     `json:"tags"`
}

type GameModerationLogEntry struct {
	ID          string    `json:"id"`
	GameID      string    `json:"game_id"`
	ModeratorID *string   `json:"moderator_id"`
	Action      string    `json:"action"`
	Reason      *string   `json:"reason"`
	CreatedAt   time.Time `json:"created_at"`
}

type ChatConversation struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ChatMessage struct {
	ID             string    `json:"id"`
	ConversationID string    `json:"conversation_id"`
	UserID         string    `json:"user_id"`
	Role           string    `json:"role"`
	Content        string    `json:"content"`
	CreatedAt      time.Time `json:"created_at"`
}
