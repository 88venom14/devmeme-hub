package migrations

import (
	"context"
	"embed"
	"fmt"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
)

//go:embed sql/*.up.sql
var files embed.FS

type Migration struct {
	Version string
	Name    string
	SQL     string
}

func Up(ctx context.Context, conn *pgx.Conn) error {
	migrations, err := load()
	if err != nil {
		return err
	}

	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(897654321)`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS public.schema_migrations (
			version TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`); err != nil {
		return err
	}

	applied := map[string]bool{}
	rows, err := tx.Query(ctx, `SELECT version FROM public.schema_migrations`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			rows.Close()
			return err
		}
		applied[version] = true
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()

	for _, migration := range migrations {
		if applied[migration.Version] {
			continue
		}
		if _, err := tx.Exec(ctx, migration.SQL); err != nil {
			return fmt.Errorf("apply migration %s: %w", migration.Name, err)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO public.schema_migrations (version, name)
			VALUES ($1, $2)
		`, migration.Version, migration.Name); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func load() ([]Migration, error) {
	entries, err := files.ReadDir("sql")
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() || !strings.HasSuffix(name, ".up.sql") {
			continue
		}
		names = append(names, name)
	}
	sort.Strings(names)

	result := make([]Migration, 0, len(names))
	for _, name := range names {
		content, err := files.ReadFile("sql/" + name)
		if err != nil {
			return nil, err
		}
		version := strings.SplitN(name, "_", 2)[0]
		result = append(result, Migration{
			Version: version,
			Name:    name,
			SQL:     string(content),
		})
	}
	return result, nil
}
