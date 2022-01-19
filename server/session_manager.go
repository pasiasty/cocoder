package server

import (
	"bytes"
	"encoding/gob"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/go-redis/redis"
	"github.com/google/uuid"
	"github.com/sergi/go-diff/diffmatchpatch"
)

var (
	sessionExpiry = time.Hour * 24 * 7
)

const (
	cursorSpecialSequence = "阳цąß"
)

func init() {
	gob.Register(&Session{})
}

type SessionID string

type SessionManager struct {
	c *redis.Client
}

type Session struct {
	Text     string `diff:"Text"`
	Language string `diff:"Text"`
}

func NewSessionManager(c *redis.Client) *SessionManager {
	if _, err := c.Ping().Result(); err != nil {
		log.Fatalf(fmt.Sprintf("Could not connect to redis: %v", err))
	}

	return &SessionManager{
		c: c,
	}
}

func (m *SessionManager) NewSession() SessionID {
	newSessionID := SessionID(uuid.New().String())
	if err := m.c.Set(string(newSessionID), serializeSession(&Session{}), sessionExpiry).Err(); err != nil {
		log.Printf("Could not create the session: %v", err)
		return ""
	}
	return newSessionID
}

func (m *SessionManager) LoadSession(session SessionID) (*Session, error) {
	if exists, err := m.c.Exists(string(session)).Result(); err != nil && err != redis.Nil {
		return nil, fmt.Errorf("failed to check if session '%s' exists", session)
	} else if exists == 0 {
		return nil, fmt.Errorf("session '%s' does not exist", session)
	}
	if val, err := m.c.Get(string(session)).Result(); err != nil && err != redis.Nil {
		return nil, fmt.Errorf("failed to load session '%s'", session)
	} else {
		return deserializeSession(val), nil
	}
}

func transform(req *UpdateSessionRequest, s *Session) *UpdateSessionResponse {
	if req.CursorPos < 0 || req.CursorPos > len(req.NewText) {
		req.CursorPos = 0
	}

	wasMerged := req.BaseText != s.Text

	req.NewText = req.NewText[:req.CursorPos] + cursorSpecialSequence + req.NewText[req.CursorPos:]

	dmp := diffmatchpatch.New()
	userPatches := dmp.PatchMake(dmp.DiffMain(req.BaseText, req.NewText, false))
	textWithCursor, _ := dmp.PatchApply(userPatches, s.Text)

	newCursorPos := strings.Index(textWithCursor, cursorSpecialSequence)
	s.Text = strings.ReplaceAll(textWithCursor, cursorSpecialSequence, "")

	return &UpdateSessionResponse{
		NewText:   s.Text,
		CursorPos: newCursorPos,
		WasMerged: wasMerged,
		Language:  s.Language,
	}
}

func serializeSession(s *Session) string {
	b := new(bytes.Buffer)
	e := gob.NewEncoder(b)
	if err := e.Encode(s); err != nil {
		panic(fmt.Sprintf("Failed to encode session (%v): %v", s, err))
	}
	return b.String()
}

func deserializeSession(s string) *Session {
	res := &Session{}
	b := bytes.NewBuffer([]byte(s))
	d := gob.NewDecoder(b)
	if err := d.Decode(res); err != nil {
		panic(fmt.Sprintf("Failed to decode session (%v): %v", s, err))
	}
	return res
}

func (m *SessionManager) UpdateSessionText(sessionID SessionID, req *UpdateSessionRequest) (*UpdateSessionResponse, error) {
	resp := &UpdateSessionResponse{}
	if err := m.c.Watch(func(tx *redis.Tx) error {
		ss, err := tx.Get(string(sessionID)).Result()
		if err != nil && err != redis.Nil {
			return err
		}
		session := deserializeSession(ss)

		_, err = tx.Pipelined(func(pipe redis.Pipeliner) error {
			resp = transform(req, session)
			pipe.Set(string(sessionID), serializeSession(session), sessionExpiry)
			return nil
		})
		return err
	}, string(sessionID)); err != nil {
		return nil, fmt.Errorf("failed to update session '%s': %v", sessionID, err)
	}

	return resp, nil
}

func (m *SessionManager) UpdateLanguage(sessionID SessionID, req *UpdateLanguageRequest) error {
	if err := m.c.Watch(func(tx *redis.Tx) error {
		ss, err := tx.Get(string(sessionID)).Result()
		if err != nil && err != redis.Nil {
			return err
		}
		session := deserializeSession(ss)

		_, err = tx.Pipelined(func(pipe redis.Pipeliner) error {
			session.Language = req.Language
			pipe.Set(string(sessionID), serializeSession(session), sessionExpiry)
			return nil
		})
		return err
	}, string(sessionID)); err != nil {
		return fmt.Errorf("failed to update session '%s': %v", sessionID, err)
	}

	return nil
}
