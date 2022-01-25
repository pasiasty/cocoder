package server

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/r3labs/diff/v2"
)

func TestUpdateText(t *testing.T) {
	specialDate := time.Date(2015, 2, 13, 0, 0, 0, 0, time.UTC)
	cursorSpecialGlyph = "|"

	for _, tc := range []struct {
		name     string
		s        Session
		req      UpdateSessionRequest
		wantResp UpdateSessionResponse
	}{{
		name: "two_users_not_colliding",
		s: Session{
			Text: "some text",
			Users: map[string]*User{
				"user_1": {
					ID:       "user_1",
					Index:    0,
					Position: 9,
					LastEdit: specialDate,
				},
				"user_2": {
					ID:       "user_2",
					Index:    1,
					Position: 0,
					LastEdit: specialDate,
				},
			},
		},
		req: UpdateSessionRequest{
			UserID:    "user_1",
			BaseText:  "some text",
			NewText:   "some texta",
			CursorPos: 10,
		},
		wantResp: UpdateSessionResponse{
			NewText:   "some texta",
			CursorPos: 10,
			OtherUsers: []OtherUser{
				{
					CursorPos: 0,
					Index:     1,
				},
			},
		},
	}, {
		name: "two_users_colliding",
		s: Session{
			Text: "some text",
			Users: map[string]*User{
				"user_1": {
					ID:       "user_1",
					Index:    0,
					Position: 0,
					LastEdit: specialDate,
				},
				"user_2": {
					ID:       "user_2",
					Index:    1,
					Position: 9,
					LastEdit: specialDate,
				},
			},
		},
		req: UpdateSessionRequest{
			UserID:    "user_1",
			BaseText:  "some text",
			NewText:   "asome text",
			CursorPos: 1,
		},
		wantResp: UpdateSessionResponse{
			NewText:   "asome text",
			CursorPos: 1,
			OtherUsers: []OtherUser{
				{
					Index:     1,
					CursorPos: 10,
				},
			},
		},
	}} {
		t.Run(tc.name, func(t *testing.T) {
			nowSource = func() time.Time { return specialDate }
			resp := tc.s.UpdateText(&tc.req)

			changelog, err := diff.Diff(*resp, tc.wantResp)
			if err != nil {
				t.Fatalf("Diffing failed, but shouldn't: %v", err)
			}

			if len(changelog) > 0 {
				t.Errorf("Following changes were detected:\n%v", changelog)
				gotStr, _ := json.MarshalIndent(resp, "", "  ")
				wantStr, _ := json.MarshalIndent(tc.wantResp, "", "  ")
				t.Errorf("Want:\n%s", wantStr)
				t.Errorf("Got:\n%s", gotStr)
			}
		})
	}
}
