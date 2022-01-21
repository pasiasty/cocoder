package server

import (
	"bytes"
	"encoding/gob"
	"fmt"
	"log"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/go-redis/redis"
	"github.com/google/uuid"
	"github.com/sergi/go-diff/diffmatchpatch"
)

var (
	sessionExpiry = time.Hour * 24 * 7

	nowSource = time.Now

	cursorSpecialGlyph = "!!@@##AA"
)

func cursorSpecialSequenceFormat() string {
	return cursorSpecialGlyph + "%v" + cursorSpecialGlyph
}

func cursorSpecialSequenceRe() *regexp.Regexp {
	glyphEscaped := ""
	for _, c := range cursorSpecialGlyph {
		glyphEscaped += fmt.Sprintf("[%s]", string(c))
	}
	return regexp.MustCompile("(" + glyphEscaped + "[0-9]+" + glyphEscaped + ")")
}

func init() {
	gob.Register(&Session{})
	gob.Register(&User{})
}

type SessionID string

type SessionManager struct {
	c *redis.Client
}

type User struct {
	ID       string    `json:"ID" diff:"ID"`
	Index    int       `json:"Index" diff:"Index"`
	Position int       `json:"Position" diff:"Position"`
	LastEdit time.Time `json:"LastEdit" diff:"LastEdit"`
}

type Session struct {
	Text     string    `json:"Text" diff:"Text"`
	Language string    `json:"Language" diff:"Language"`
	LastEdit time.Time `json:"LastEdit" diff:"LastEdit"`

	Users map[string]*User `json:"Users" diff:"Users"`
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
	if err := m.c.Set(string(newSessionID), serializeSession(&Session{
		Language: "plaintext",
		Users:    make(map[string]*User),
	}), sessionExpiry).Err(); err != nil {
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

func usersSortedByPositions(m map[string]*User) []*User {
	res := []*User{}
	for _, u := range m {
		res = append(res, u)
	}

	sort.Slice(res, func(i, j int) bool {
		return res[i].Position > res[j].Position
	})
	return res
}

func updateSessionTextProcessor(reqInt interface{}, s *Session) interface{} {
	now := nowSource()

	req := reqInt.(*UpdateSessionRequest)
	if req.CursorPos < 0 || req.CursorPos > len(req.NewText) {
		req.CursorPos = 0
	}

	wasMerged := req.BaseText != s.Text

	if user, ok := s.Users[req.UserID]; ok {
		user.Position = req.CursorPos
		user.LastEdit = now
	} else {
		s.Users[req.UserID] = &User{
			ID:       req.UserID,
			Index:    len(s.Users),
			Position: req.CursorPos,
			LastEdit: now,
		}
	}

	for _, u := range usersSortedByPositions(s.Users) {
		if u.ID == req.UserID {
			req.NewText = req.NewText[:u.Position] + fmt.Sprintf(cursorSpecialSequenceFormat(), u.Index) + req.NewText[u.Position:]
		} else {
			s.Text = s.Text[:u.Position] + fmt.Sprintf(cursorSpecialSequenceFormat(), u.Index) + s.Text[u.Position:]
		}

	}

	dmp := diffmatchpatch.New()
	userPatches := dmp.PatchMake(dmp.DiffMain(req.BaseText, req.NewText, false))
	textWithCursors, _ := dmp.PatchApply(userPatches, s.Text)

	newCursorPos := -1

	for _, u := range s.Users {
		rawNewPosition := strings.Index(textWithCursors, fmt.Sprintf(cursorSpecialSequenceFormat(), u.Index))
		if rawNewPosition < 0 {
			rawNewPosition = 0
		}
		u.Position = len(cursorSpecialSequenceRe().ReplaceAllString(textWithCursors[:rawNewPosition], ""))
		if u.ID == req.UserID {
			newCursorPos = u.Position
		}
	}

	s.Text = cursorSpecialSequenceRe().ReplaceAllString(textWithCursors, "")

	s.LastEdit = now

	otherUsers := []OtherUser{}

	for _, u := range s.Users {
		if u.ID == req.UserID || now.Sub(u.LastEdit) > time.Minute {
			continue
		}
		otherUsers = append(otherUsers, OtherUser{
			Index:     u.Index,
			CursorPos: u.Position,
		})
	}

	return &UpdateSessionResponse{
		NewText:    s.Text,
		CursorPos:  newCursorPos,
		WasMerged:  wasMerged,
		Language:   s.Language,
		OtherUsers: otherUsers,
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

func (m *SessionManager) UpdateSessionText(sessionID SessionID, req *UpdateSessionRequest) (*UpdateSessionResponse, error) {
	resp, err := m.modifySession(sessionID, req, updateSessionTextProcessor)
	if err != nil {
		return nil, err
	}
	return resp.(*UpdateSessionResponse), nil
}

func updateLanguageProcessor(reqInt interface{}, s *Session) interface{} {
	req := reqInt.(*UpdateLanguageRequest)
	s.Language = req.Language
	return nil
}

func (m *SessionManager) UpdateLanguage(sessionID SessionID, req *UpdateLanguageRequest) error {
	_, err := m.modifySession(sessionID, req, updateLanguageProcessor)
	return err
}
