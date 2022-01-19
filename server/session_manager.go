package server

import (
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

type SessionID string

type SessionManager struct {
	c *redis.Client
}

type EditState struct {
	BaseText  string `diff:"base_text"`
	NewText   string `diff:"new_text"`
	CursorPos int    `diff:"cursor_pos"`
	WasMerged bool   `diff:"was_merged"`
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
	if err := m.c.Set(string(newSessionID), "", sessionExpiry).Err(); err != nil {
		log.Printf("Could not create the session: %v", err)
		return ""
	}
	return newSessionID
}

func (m *SessionManager) LoadSession(session SessionID) (string, error) {
	if exists, err := m.c.Exists(string(session)).Result(); err != nil && err != redis.Nil {
		return "", fmt.Errorf("failed to check if session '%s' exists", session)
	} else if exists == 0 {
		return "", fmt.Errorf("session '%s' does not exist", session)
	}
	if val, err := m.c.Get(string(session)).Result(); err != nil && err != redis.Nil {
		return "", fmt.Errorf("failed to load session '%s'", session)
	} else {
		return val, nil
	}
}

func transform(es EditState, text string) EditState {
	if es.CursorPos < 0 || es.CursorPos > len(es.NewText) {
		es.CursorPos = 0
	}

	wasMerged := es.BaseText != text

	es.NewText = es.NewText[:es.CursorPos] + cursorSpecialSequence + es.NewText[es.CursorPos:]

	dmp := diffmatchpatch.New()
	userPatches := dmp.PatchMake(dmp.DiffMain(es.BaseText, es.NewText, false))
	textWithCursor, _ := dmp.PatchApply(userPatches, text)

	newCursorPos := strings.Index(textWithCursor, cursorSpecialSequence)
	text = strings.ReplaceAll(textWithCursor, cursorSpecialSequence, "")

	return EditState{
		NewText:   text,
		CursorPos: newCursorPos,
		WasMerged: wasMerged,
	}
}

func (m *SessionManager) UpdateSessionText(session SessionID, editState EditState) (EditState, error) {
	if err := m.c.Watch(func(tx *redis.Tx) error {
		text, err := tx.Get(string(session)).Result()
		if err != nil && err != redis.Nil {
			return err
		}

		_, err = tx.Pipelined(func(pipe redis.Pipeliner) error {
			editState = transform(editState, text)
			pipe.Set(string(session), editState.NewText, sessionExpiry)
			return nil
		})
		return err
	}, string(session)); err != nil {
		return EditState{}, fmt.Errorf("failed to update session '%s': %v", session, err)
	}

	return editState, nil
}
