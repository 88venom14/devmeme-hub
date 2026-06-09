package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"devmeme-hub/backend/internal/config"
	"devmeme-hub/backend/internal/migrations"

	"github.com/jackc/pgx/v5"
)

func main() {
	databaseURL, err := config.DatabaseURL()
	if err != nil {
		slog.Error("invalid configuration", "error", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
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

	slog.Info("migrations applied")
}
