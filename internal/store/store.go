package store

import (
	"context"
	"crypto/rand"
	"errors"
	"time"
)

// ErrNotFound is returned by Load when no session exists for a code.
var ErrNotFound = errors.New("store: session not found")

// Session is a persisted configuration: the user's battery quantities, addressed
// by a generated share code, with the time it was saved.
type Session struct {
	Code       string         `json:"code"`
	Quantities map[string]int `json:"quantities"`
	CreatedAt  time.Time      `json:"createdAt"`
}

// Store saves and loads sessions. Implementations must be safe for concurrent use.
type Store interface {
	// Save persists the quantities under a freshly generated share code, which it
	// returns. The caller is responsible for validating quantities first.
	Save(ctx context.Context, quantities map[string]int) (string, error)
	// Load returns the session for a code, or ErrNotFound if there is none.
	Load(ctx context.Context, code string) (Session, error)
	// Close releases the underlying resources.
	Close() error
}

const codeAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

// codeLength is the number of characters in a share code: 32^6 ≈ 1.1 billion codes.
const codeLength = 6

// newCode returns a random share code drawn uniformly from codeAlphabet.
func newCode() (string, error) {
	buf := make([]byte, codeLength)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	for i := range buf {
		buf[i] = codeAlphabet[int(buf[i])%len(codeAlphabet)]
	}
	return string(buf), nil
}
