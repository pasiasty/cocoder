package server

import (
	"fmt"
	"sync"

	"github.com/sergi/go-diff/diffmatchpatch"
)

var MaxHangingMessages = 10

type UserID string
type SessionID string

type Session struct {
	m     sync.Mutex
	id    SessionID
	users map[UserID]chan string

	text string
}

func newSession(id SessionID) *Session {
	return &Session{
		id:    id,
		users: make(map[UserID]chan string),
	}
}

func (s *Session) addUser(user UserID) error {
	s.m.Lock()
	defer s.m.Unlock()

	if _, ok := s.users[user]; ok {
		return fmt.Errorf("user '%s' already added to the session '%s", user, s.id)
	}
	s.users[user] = make(chan string, MaxHangingMessages)
	return nil
}

func (s *Session) removeUser(user UserID) error {
	s.m.Lock()
	defer s.m.Unlock()

	if userChan, ok := s.users[user]; !ok {
		return fmt.Errorf("user '%s' not found in the session '%s'", user, s.id)
	} else {
		close(userChan)
		delete(s.users, user)
	}

	return nil
}

func (s *Session) updateText(user UserID, baseText, newText string) string {
	s.m.Lock()
	defer s.m.Unlock()

	dmp := diffmatchpatch.New()
	userPatches := dmp.PatchMake(dmp.DiffMain(baseText, newText, false))
	s.text, _ = dmp.PatchApply(userPatches, s.text)

	for u, c := range s.users {
		if u == user {
			continue
		}

		if len(c) < cap(c) {
			c <- s.text
		}
	}

	return s.text
}
