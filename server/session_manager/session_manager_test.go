package session_manager

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis"
	"github.com/go-redis/redis"
	"github.com/r3labs/diff/v2"

	"github.com/pasiasty/cocoder/server/common"
)

func prepareSessionManager(t *testing.T) *SessionManager {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("Failed to setup miniredis: %v", err)
	}
	return NewSessionManager(redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	}))
}

func TestNewSession(t *testing.T) {
	sm := prepareSessionManager(t)
	createdIDs := make(map[SessionID]interface{})
	for i := 0; i < 100; i++ {
		newID := sm.NewSession()
		if _, ok := createdIDs[newID]; ok {
			t.Errorf("session IDs should not duplicate, but %s did", newID)
		}
		createdIDs[newID] = new(interface{})
	}
}

func TestSerializeDeserialize(t *testing.T) {
	for _, tc := range []struct {
		name string
		s    *Session
	}{{
		name: "empty",
		s:    &Session{},
	}, {
		name: "something",
		s: &Session{
			Text: "abc",
		},
	}} {
		t.Run(tc.name, func(t *testing.T) {
			s := deserializeSession(serializeSession(tc.s))

			changelog, err := diff.Diff(s, tc.s)
			if err != nil {
				t.Fatalf("Diffing failed, but shouldn't: %v", err)
			}

			if len(changelog) > 0 {
				t.Errorf("Following changes were detected:\n%v", changelog)
			}
		})
	}
}

func TestLoadSession(t *testing.T) {
	ctx := context.Background()
	sm := prepareSessionManager(t)

	userID1 := "user_1"
	date1 := time.Date(2015, 2, 13, 0, 0, 0, 0, time.UTC)
	userID2 := "user_2"
	date2 := time.Date(2018, 9, 26, 0, 0, 0, 0, time.UTC)

	existingSessionID1 := sm.NewSession()
	existingSessionID2 := sm.NewSession()
	nonexistingSessionID := "abc123"

	sampleText := "abc"
	sampleLanguage := "python"

	anotherSampleText := "def"
	defaultLanguage := "plaintext"

	nowSource = func() time.Time { return date1 }

	if _, err := sm.UpdateSession(ctx, existingSessionID1, &common.UpdateSessionRequest{
		NewText:  sampleText,
		UserID:   userID1,
		Language: sampleLanguage,
	}); err != nil {
		t.Fatalf("Failed to update session text: %v", err)
	}

	nowSource = func() time.Time { return date2 }

	if _, err := sm.UpdateSession(ctx, existingSessionID2, &common.UpdateSessionRequest{
		UserID: userID1,
	}); err != nil {
		t.Fatalf("Failed to update session text: %v", err)
	}

	if _, err := sm.UpdateSession(ctx, existingSessionID2, &common.UpdateSessionRequest{
		NewText: anotherSampleText,
		UserID:  userID2,
	}); err != nil {
		t.Fatalf("Failed to update session text: %v", err)
	}

	for _, tc := range []struct {
		name        string
		sessionID   SessionID
		wantError   bool
		wantSession *Session
	}{{
		name:      "proper_session",
		sessionID: existingSessionID1,
		wantSession: &Session{
			Text:     sampleText,
			Language: sampleLanguage,
			LastEdit: date1,
			Users: map[string]*common.User{
				userID1: {
					ID:       userID1,
					Index:    0,
					LastEdit: date1,
					Position: 0,
				},
			},
		},
	}, {
		name:      "proper_session_default_language",
		sessionID: existingSessionID2,
		wantSession: &Session{
			Text:     anotherSampleText,
			Language: defaultLanguage,
			LastEdit: date2,
			Users: map[string]*common.User{
				userID1: {
					ID:       userID1,
					Index:    0,
					LastEdit: date2,
					Position: 0,
				},
				userID2: {
					ID:       userID2,
					Index:    1,
					LastEdit: date2,
					Position: 0,
				},
			},
		},
	}, {
		name:      "non_existing_session",
		sessionID: SessionID(nonexistingSessionID),
		wantError: true,
	}} {
		t.Run(tc.name, func(t *testing.T) {
			s, err := sm.LoadSession(tc.sessionID)
			if err != nil && !tc.wantError {
				t.Errorf("LoadSession shouldn't have failed but did: %v", err)
			}
			if err == nil && tc.wantError {
				t.Error("LoadSession should've failed, but didn't")
			}

			changelog, err := diff.Diff(s, tc.wantSession)
			if err != nil {
				t.Fatalf("Diffing failed, but shouldn't: %v", err)
			}

			if len(changelog) > 0 {
				t.Errorf("Following changes were detected:\n%v", changelog)
				wsJson, _ := json.MarshalIndent(tc.wantSession, "", "  ")
				sJson, _ := json.MarshalIndent(s, "", "  ")
				t.Errorf("Want:\n%v", string(wsJson))
				t.Errorf("Got:\n%v", string(sJson))
			}
		})
	}
}

func editRequestForTesting(es string) *common.UpdateSessionRequest {
	i := strings.Index(es, "|")
	return &common.UpdateSessionRequest{
		NewText:   strings.Replace(es, "|", "", 1),
		CursorPos: i,
	}
}

func editResponseForTesting(es string) *common.UpdateSessionResponse {
	return &common.UpdateSessionResponse{
		NewText:  strings.Replace(es, "|", "", 1),
		Language: "plaintext",
	}
}

func TestUpdateSessionText(t *testing.T) {
	for _, tc := range []struct {
		name            string
		initialState    string
		clientBase      string
		clientEditState string
		wantEditState   string
	}{{
		name:            "append_to_empty",
		clientEditState: "abc|",
		wantEditState:   "abc|",
	}, {
		name: "simultaneous_edit",
		initialState: `Here's something original
	
		animal of the year is:
		fruit of the year is: banana
		`,
		clientBase: `Here's something original
	
		animal of the year is:
		fruit of the year is:
		`,
		clientEditState: `Here's something original
	
		animal of the year is: gorilla|
		fruit of the year is:
		`,
		wantEditState: `Here's something original
	
		animal of the year is: gorilla|
		fruit of the year is: banana
		`,
	}, {
		name: "cursor_at_whitespaces",
		clientEditState: `abc
		
		
		|`,
		wantEditState: `abc
		
		
		|`,
	}} {
		ctx := context.Background()

		t.Run(tc.name, func(t *testing.T) {
			sm := prepareSessionManager(t)
			s := sm.NewSession()

			if _, err := sm.UpdateSession(ctx, s, &common.UpdateSessionRequest{NewText: tc.initialState}); err != nil {
				t.Fatalf("Initial edit should not fail, but did: %v", err)
			}

			es := editRequestForTesting(tc.clientEditState)
			es.BaseText = tc.clientBase

			resEs, err := sm.UpdateSession(ctx, s, es)
			if err != nil {
				t.Fatalf("Test edit fail, but shouldn't: %v", err)
			}
			resEs.Users = nil
			wantEs := editResponseForTesting(tc.wantEditState)

			changelog, err := diff.Diff(resEs, wantEs)
			if err != nil {
				t.Fatalf("Diffing failed, but shouldn't: %v", err)
			}

			if len(changelog) > 0 {
				t.Errorf("Following changes were detected:\n%v", changelog)
				gotStr, _ := json.MarshalIndent(resEs, "", "  ")
				wantStr, _ := json.MarshalIndent(wantEs, "", "  ")
				t.Errorf("Want:\n%s", wantStr)
				t.Errorf("Got:\n%s", gotStr)
			}
		})
	}
}
