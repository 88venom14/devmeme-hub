package main

import (
	"bufio"
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/jackc/pgx/v5"
)

type exportTable struct {
	Schema  string
	Name    string
	Query   string
	Count   string
	OutName string
}

func main() {
	databaseURL := os.Getenv("SUPABASE_DATABASE_URL")
	if databaseURL == "" {
		slog.Error("SUPABASE_DATABASE_URL is required")
		os.Exit(1)
	}

	outDir := os.Getenv("SUPABASE_BACKUP_DIR")
	if outDir == "" {
		outDir = filepath.Join("..", "backups", "devmeme_supabase_jsonl")
	}
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		slog.Error("create output dir", "error", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
	defer cancel()

	conn, err := pgx.Connect(ctx, databaseURL)
	if err != nil {
		slog.Error("connect supabase", "error", err)
		os.Exit(1)
	}
	defer conn.Close(context.Background())

	tables := []exportTable{
		publicTable("profiles"),
		publicTable("posts"),
		publicTable("comments"),
		publicTable("stars"),
		publicTable("follows"),
		publicTable("tags"),
		publicTable("post_tags"),
		publicTable("saved_posts"),
		publicTable("user_activity"),
		publicTable("chat_conversations"),
		publicTable("chat_messages"),
		{
			Schema:  "auth",
			Name:    "users",
			OutName: "auth_users.jsonl",
			Query: `select row_to_json(t)::text
				from (
					select id, email, encrypted_password, email_confirmed_at, last_sign_in_at,
						raw_app_meta_data, raw_user_meta_data, created_at, updated_at, deleted_at
					from auth.users
					order by created_at, id
				) t`,
		},
	}

	counts := map[string]int{}
	for _, table := range tables {
		count, err := exportOne(ctx, conn, outDir, table)
		if err != nil {
			slog.Error("export table", "table", table.Schema+"."+table.Name, "error", err)
			os.Exit(1)
		}
		counts[table.Schema+"."+table.Name] = count
		slog.Info("exported", "table", table.Schema+"."+table.Name, "rows", count)
	}

	countFile, err := os.Create(filepath.Join(outDir, "counts.txt"))
	if err != nil {
		slog.Error("create counts", "error", err)
		os.Exit(1)
	}
	defer countFile.Close()
	for _, table := range tables {
		_, _ = fmt.Fprintf(countFile, "%s.%s=%d\n", table.Schema, table.Name, counts[table.Schema+"."+table.Name])
	}
}

func publicTable(name string) exportTable {
	return exportTable{
		Schema:  "public",
		Name:    name,
		OutName: "public_" + name + ".jsonl",
		Query:   fmt.Sprintf("select row_to_json(t)::text from public.%s t", pgx.Identifier{name}.Sanitize()),
		Count:   fmt.Sprintf("select count(*) from public.%s", pgx.Identifier{name}.Sanitize()),
	}
}

func exportOne(ctx context.Context, conn *pgx.Conn, outDir string, table exportTable) (int, error) {
	if table.Schema == "public" && table.Name == "posts" {
		return exportByID(ctx, conn, outDir, table, "id")
	}

	if table.Count != "" {
		var expected int
		if err := conn.QueryRow(ctx, table.Count).Scan(&expected); err != nil {
			return 0, err
		}
		if existingLines(filepath.Join(outDir, table.OutName)) == expected {
			return expected, nil
		}
	}

	outPath := filepath.Join(outDir, table.OutName)
	file, err := os.Create(outPath)
	if err != nil {
		return 0, err
	}
	defer file.Close()

	rows, err := conn.Query(ctx, table.Query)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var line string
		if err := rows.Scan(&line); err != nil {
			return count, err
		}
		if _, err := file.WriteString(line + "\n"); err != nil {
			return count, err
		}
		count++
	}
	return count, rows.Err()
}

func exportByID(ctx context.Context, conn *pgx.Conn, outDir string, table exportTable, idColumn string) (int, error) {
	if table.Count != "" {
		var expected int
		if err := conn.QueryRow(ctx, table.Count).Scan(&expected); err != nil {
			return 0, err
		}
		if existingLines(filepath.Join(outDir, table.OutName)) == expected {
			return expected, nil
		}
	}

	idRows, err := conn.Query(ctx, fmt.Sprintf("select %s::text from public.%s order by created_at, id", idColumn, pgx.Identifier{table.Name}.Sanitize()))
	if err != nil {
		return 0, err
	}
	ids := make([]string, 0)
	for idRows.Next() {
		var id string
		if err := idRows.Scan(&id); err != nil {
			idRows.Close()
			return 0, err
		}
		ids = append(ids, id)
	}
	if err := idRows.Err(); err != nil {
		idRows.Close()
		return 0, err
	}
	idRows.Close()

	outPath := filepath.Join(outDir, table.OutName)
	file, err := os.Create(outPath)
	if err != nil {
		return 0, err
	}
	defer file.Close()

	for _, id := range ids {
		var line string
		query := fmt.Sprintf("select row_to_json(t)::text from public.%s t where %s = $1", pgx.Identifier{table.Name}.Sanitize(), idColumn)
		if err := conn.QueryRow(ctx, query, id).Scan(&line); err != nil {
			return 0, err
		}
		if _, err := file.WriteString(line + "\n"); err != nil {
			return 0, err
		}
	}
	return len(ids), nil
}

func existingLines(path string) int {
	file, err := os.Open(path)
	if err != nil {
		return -1
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	buf := make([]byte, 1024*1024)
	scanner.Buffer(buf, 64*1024*1024)
	count := 0
	for scanner.Scan() {
		count++
	}
	if scanner.Err() != nil {
		return -1
	}
	return count
}
