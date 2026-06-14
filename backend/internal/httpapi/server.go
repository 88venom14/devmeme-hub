package httpapi

import (
	"net/http"
	"strings"
	"time"

	"devmeme-hub/backend/internal/config"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Server struct {
	cfg config.Config
	db  *pgxpool.Pool
}

func NewServer(cfg config.Config, pool *pgxpool.Pool) *Server {
	return &Server{cfg: cfg, db: pool}
}

func (s *Server) Routes() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   s.cfg.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	r.Use(s.limitBody)

	r.Get("/healthz", s.health)
	mediaServer := http.StripPrefix("/media/", http.FileServer(http.Dir(s.cfg.MediaDir)))
	r.Handle("/media/*", noSniff(mediaServer))

	r.Route("/api", func(r chi.Router) {
		r.Post("/auth/register", s.register)
		r.Post("/auth/login", s.login)

		r.Group(func(r chi.Router) {
			r.Use(s.requireUser)
			r.Get("/auth/me", s.me)
			r.Get("/settings", s.getSettings)
			r.Put("/settings", s.updateSettings)
			r.Get("/profiles/me", s.myProfile)
			r.Patch("/profiles/me", s.updateMyProfile)
			r.Post("/posts", s.createPost)
			r.Delete("/posts/{postID}", s.deletePost)
			r.Get("/posts/{postID}/interactions", s.getPostInteractions)
			r.Post("/posts/{postID}/star", s.starPost)
			r.Delete("/posts/{postID}/star", s.unstarPost)
			r.Post("/posts/{postID}/save", s.savePost)
			r.Delete("/posts/{postID}/save", s.unsavePost)
			r.Get("/saved-posts", s.listSavedPosts)
			r.Post("/comments", s.createComment)
			r.Delete("/comments/{commentID}", s.deleteComment)
			r.Post("/media", s.uploadMedia)
			r.Post("/profiles/{profileID}/follow", s.followProfile)
			r.Delete("/profiles/{profileID}/follow", s.unfollowProfile)
			r.Get("/profiles/{profileID}/follow-status", s.getFollowStatus)
			r.Get("/following/posts", s.listFollowingPosts)
			r.Get("/chat/conversations", s.listChatConversations)
			r.Post("/chat/conversations", s.createChatConversation)
			r.Delete("/chat/conversations/{conversationID}", s.deleteChatConversation)
			r.Get("/chat/conversations/{conversationID}/messages", s.listChatMessages)
			r.Post("/chat/conversations/{conversationID}/messages", s.createChatMessage)
		})

		r.Get("/posts", s.listPosts)
		r.Get("/posts/{postID}", s.getPost)
		r.Get("/posts/{postID}/comments", s.listComments)

		// Profile reads adjust to the viewer (followers-only privacy), so they
		// use optional auth: a token is honored if present, not required.
		r.Group(func(r chi.Router) {
			r.Use(s.optionalUser)
			r.Get("/profiles/{profileID}", s.getProfileByID)
			r.Get("/profiles/username/{username}", s.getProfileByUsername)
			r.Get("/profiles/{profileID}/posts", s.listProfilePosts)
			r.Get("/profiles/{profileID}/liked", s.listProfileLikedPosts)
			r.Get("/profiles/{profileID}/stats", s.getProfileStats)
		})

		r.Get("/search", s.search)
		r.Get("/tags/top", s.listTopTags)
		r.Get("/tags/{name}/posts", s.listTagPosts)
		r.Get("/trending/posts", s.listTrendingPosts)
	})

	return r
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if err := s.db.Ping(ctx); err != nil {
		writeError(w, http.StatusServiceUnavailable, "database unavailable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) limitBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Body != nil {
			r.Body = http.MaxBytesReader(w, r.Body, s.cfg.MaxRequestBytes)
		}
		next.ServeHTTP(w, r)
	})
}

// noSniff prevents browsers from MIME-sniffing user-uploaded media into an
// executable type (e.g. treating an uploaded file as HTML/JS).
func noSniff(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		next.ServeHTTP(w, r)
	})
}

func bearerToken(header string) string {
	if header == "" {
		return ""
	}
	parts := strings.Fields(header)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return parts[1]
}
