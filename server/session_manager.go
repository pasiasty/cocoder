package server

import (
	"encoding/gob"
	"fmt"
	"log"
	"sort"
	"time"

	"github.com/go-redis/redis"
	"github.com/google/uuid"
)

var (
	sessionExpiry = time.Hour * 24 * 7

	nowSource = time.Now

	cursorSpecialGlyph = "!!@@##AA"
)

func init() {
	gob.Register(&Session{})
	gob.Register(&User{})
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

func sequencesToInsertByPosition(m map[string]*User) []SpecialSequence {
	res := []SpecialSequence{}
	for _, u := range m {
		res = append(res, u.sequencesToInsert()...)
	}

	sort.Slice(res, func(i, j int) bool {
		return res[i].position > res[j].position
	})
	return res
}

type requestProcessor = func(req interface{}, s *Session) interface{}

func (m *SessionManager) modifySession(sessionID SessionID, req interface{}, processor requestProcessor) (interface{}, error) {
	resp := *new(interface{})
	if err := m.c.Watch(func(tx *redis.Tx) error {
		ss, err := tx.Get(string(sessionID)).Result()
		if err != nil && err != redis.Nil {
			return err
		}
		session := deserializeSession(ss)

		_, err = tx.Pipelined(func(pipe redis.Pipeliner) error {
			resp = processor(req, session)
			pipe.Set(string(sessionID), serializeSession(session), sessionExpiry)
			return nil
		})
		return err
	}, string(sessionID)); err != nil {
		return nil, fmt.Errorf("failed to modify session '%s': %v", sessionID, err)
	}

	return resp, nil
}

func (m *SessionManager) UpdateSession(sessionID SessionID, req *UpdateSessionRequest) (*UpdateSessionResponse, error) {
	resp, err := m.modifySession(sessionID, req, func(req interface{}, s *Session) interface{} {
		return s.Update(req.(*UpdateSessionRequest))
	})
	if err != nil {
		return nil, err
	}
	return resp.(*UpdateSessionResponse), nil
}
