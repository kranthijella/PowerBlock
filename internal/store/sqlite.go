package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	_ "modernc.org/sqlite" // pure-Go SQLite driver, registered as "sqlite" (no cgo)
)

// schema is applied on Open. created_at is stored as a Unix timestamp (INTEGER)
// rather than a SQL TIMESTAMP to avoid driver-specific time parsing quirks.
const schema = `
CREATE TABLE IF NOT EXISTS sessions (
	code       TEXT    PRIMARY KEY,
	quantities TEXT    NOT NULL,
	created_at INTEGER NOT NULL
);`

const maxCodeAttempts = 5

// SQLiteStore is a Store backed by a pure-Go SQLite database (modernc.org/sqlite).
type SQLiteStore struct {
	db *sql.DB
}

// compile-time check that SQLiteStore satisfies Store.
var _ Store = (*SQLiteStore)(nil)

func Open(path string) (*SQLiteStore, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("store: open %q: %w", path, err)
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("store: apply schema: %w", err)
	}
	return &SQLiteStore{db: db}, nil
}

// Save persists quantities under a new share code, retrying on the rare code
// collision, and returns the code.
func (s *SQLiteStore) Save(ctx context.Context, quantities map[string]int) (string, error) {
	data, err := json.Marshal(quantities)
	if err != nil {
		return "", fmt.Errorf("store: marshal quantities: %w", err)
	}
	now := time.Now().UTC().Unix()

	for attempt := 0; attempt < maxCodeAttempts; attempt++ {
		code, err := newCode()
		if err != nil {
			return "", fmt.Errorf("store: generate code: %w", err)
		}
		_, err = s.db.ExecContext(ctx,
			`INSERT INTO sessions (code, quantities, created_at) VALUES (?, ?, ?)`,
			code, string(data), now)
		if err == nil {
			return code, nil
		}
		if isUniqueViolation(err) {
			continue // collided with an existing code; try another
		}
		return "", fmt.Errorf("store: insert session: %w", err)
	}
	return "", fmt.Errorf("store: no unique code after %d attempts", maxCodeAttempts)
}

// Load returns the session for code, or ErrNotFound.
func (s *SQLiteStore) Load(ctx context.Context, code string) (Session, error) {
	var (
		quantitiesJSON string
		createdAtUnix  int64
	)
	err := s.db.QueryRowContext(ctx,
		`SELECT quantities, created_at FROM sessions WHERE code = ?`, code).
		Scan(&quantitiesJSON, &createdAtUnix)
	if errors.Is(err, sql.ErrNoRows) {
		return Session{}, ErrNotFound
	}
	if err != nil {
		return Session{}, fmt.Errorf("store: query session: %w", err)
	}

	var quantities map[string]int
	if err := json.Unmarshal([]byte(quantitiesJSON), &quantities); err != nil {
		return Session{}, fmt.Errorf("store: unmarshal quantities: %w", err)
	}
	return Session{
		Code:       code,
		Quantities: quantities,
		CreatedAt:  time.Unix(createdAtUnix, 0).UTC(),
	}, nil
}

// Close closes the underlying database.
func (s *SQLiteStore) Close() error {
	return s.db.Close()
}

// isUniqueViolation reports whether err is a SQLite UNIQUE/primary-key conflict.
func isUniqueViolation(err error) bool {
	return err != nil && strings.Contains(err.Error(), "UNIQUE")
}
