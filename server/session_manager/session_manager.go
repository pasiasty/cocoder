package session_manager

import (
	"context"
	"encoding/gob"
	"fmt"
	"log"
	"runtime/trace"
	"time"

	"github.com/go-redis/redis"
	"github.com/google/uuid"

	"github.com/pasiasty/cocoder/server/common"
)

var (
	sessionExpiry = time.Hour * 24 * 7

	nowSource = time.Now

	cursorSpecialGlyph = "!!@@##AA"
)

func init() {
	gob.Register(&Session{})
	gob.Register(&common.User{})
}

type SessionManager struct {
	c *redis.Client
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
	if err := m.c.Set(string(newSessionID), serializeSession(DefaultSession()), sessionExpiry).Err(); err != nil {
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

type requestProcessor = func(req interface{}, s *Session) interface{}

func (m *SessionManager) modifySession(ctx context.Context, sessionID SessionID, req interface{}, processor requestProcessor) (interface{}, error) {
	resp := *new(interface{})
	var watchErr error

	trace.WithRegion(ctx, "modify_session", func() {
		watchErr = m.c.Watch(func(tx *redis.Tx) error {
			trace.Log(ctx, "start", "")
			ss, err := tx.Get(string(sessionID)).Result()
			if err != nil && err != redis.Nil {
				return err
			}

			trace.Log(ctx, "deserializing", "")
			session := deserializeSession(ss)

			trace.Log(ctx, "storing", "")

			_, err = tx.Pipelined(func(pipe redis.Pipeliner) error {
				resp = processor(req, session)
				pipe.Set(string(sessionID), serializeSession(session), sessionExpiry)
				return nil
			})
			return err
		}, string(sessionID))
	})

	if watchErr != nil {
		return nil, fmt.Errorf("failed to modify session '%s': %v", sessionID, watchErr)
	}

	return resp, nil
}

func (m *SessionManager) UpdateSession(ctx context.Context, sessionID SessionID, req *common.UpdateSessionRequest) (*common.UpdateSessionResponse, error) {
	resp, err := m.modifySession(ctx, sessionID, req, func(req interface{}, s *Session) interface{} {
		return s.Update(req.(*common.UpdateSessionRequest))
	})
	if err != nil {
		return nil, err
	}
	return resp.(*common.UpdateSessionResponse), nil
}
