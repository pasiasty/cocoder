package session_manager

import (
	"fmt"
	"sort"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/pasiasty/cocoder/server/common"
)

func TestSequencesToInsertByPosition(t *testing.T) {
	for _, tc := range []struct {
		name    string
		users   []*common.User
		wantRes []SpecialSequence
	}{{
		name: "three_users_with_cursors",
		users: []*common.User{
			{
				ID:       "user_1",
				Index:    0,
				Position: 3,
			},
			{
				ID:       "user_2",
				Index:    1,
				Position: 1,
			},
			{
				ID:       "user_3",
				Index:    2,
				Position: 7,
			},
		},
		wantRes: []SpecialSequence{
			{
				userID:   "user_3",
				position: 7,
				text:     string(specialRune(2, Cursor)),
			},
			{
				userID:   "user_1",
				position: 3,
				text:     string(specialRune(0, Cursor)),
			},
			{
				userID:   "user_2",
				position: 1,
				text:     string(specialRune(1, Cursor)),
			},
		},
	}, {
		name: "two_users_with_selections",
		users: []*common.User{
			{
				ID:             "user_1",
				Index:          0,
				HasSelection:   true,
				SelectionStart: 1,
				SelectionEnd:   5,
				Position:       5,
			},
			{
				ID:             "user_2",
				Index:          1,
				HasSelection:   true,
				SelectionStart: 10,
				SelectionEnd:   20,
				Position:       20,
			},
		},
		wantRes: []SpecialSequence{
			{
				userID:   "user_2",
				text:     string(specialRune(1, Cursor)),
				position: 20,
			},
			{
				userID:   "user_2",
				text:     string(specialRune(1, SelectionEnd)),
				position: 20,
			},
			{
				userID:   "user_2",
				text:     string(specialRune(1, SelectionStart)),
				position: 10,
			},
			{
				userID:   "user_1",
				text:     string(specialRune(0, Cursor)),
				position: 5,
			},
			{
				userID:   "user_1",
				text:     string(specialRune(0, SelectionEnd)),
				position: 5,
			},
			{
				userID:   "user_1",
				text:     string(specialRune(0, SelectionStart)),
				position: 1,
			},
		},
	}} {
		t.Run(tc.name, func(t *testing.T) {
			m := map[string]*common.User{}

			for _, u := range tc.users {
				m[u.ID] = u
			}

			res := sequencesToInsertByPosition(m)
			if diff := cmp.Diff(tc.wantRes, res, cmp.AllowUnexported(SpecialSequence{})); diff != "" {
				t.Errorf("sequencesToInsertByPosition() returned wrong result -want +got:\n%v", diff)
			}
		})
	}
}

func TestValidateRequest(t *testing.T) {
	for _, tc := range []struct {
		name    string
		req     *common.UpdateSessionRequest
		wantRes *common.UpdateSessionRequest
	}{{
		name: "correct_request",
		req: &common.UpdateSessionRequest{
			NewText:   "abc",
			CursorPos: 1,
		},
		wantRes: &common.UpdateSessionRequest{
			NewText:   "abc",
			CursorPos: 1,
		},
	}, {
		name: "negative_pos",
		req: &common.UpdateSessionRequest{
			NewText:   "abc",
			CursorPos: -1,
		},
		wantRes: &common.UpdateSessionRequest{
			NewText:   "abc",
			CursorPos: 0,
		},
	}, {
		name: "too_big_cursor_pos",
		req: &common.UpdateSessionRequest{
			NewText:   "abc",
			CursorPos: 10,
		},
		wantRes: &common.UpdateSessionRequest{
			NewText:   "abc",
			CursorPos: 0,
		},
	}} {
		t.Run(tc.name, func(t *testing.T) {
			validateRequest(tc.req)
			if diff := cmp.Diff(tc.wantRes, tc.req); diff != "" {
				t.Errorf("validateRequest() did not work as intended -want +got:\n%v", diff)
			}
		})
	}
}

func TestFindTokenPosition(t *testing.T) {
	for _, tc := range []struct {
		name    string
		uIdx    int
		ro      RuneOffset
		text    string
		wantRes int
	}{{
		name:    "first_token",
		uIdx:    0,
		ro:      Cursor,
		text:    fmt.Sprintf("a %s abc %s", string(specialRune(0, Cursor)), string(specialRune(1, SelectionStart))),
		wantRes: 2,
	}, {
		name:    "second_token",
		uIdx:    1,
		ro:      SelectionStart,
		text:    fmt.Sprintf("a %s abc %s", string(specialRune(0, Cursor)), string(specialRune(1, SelectionStart))),
		wantRes: 7,
	}, {
		name:    "non_existing_token",
		uIdx:    1,
		ro:      SelectionEnd,
		text:    fmt.Sprintf("a %s abc %s", string(specialRune(0, Cursor)), string(specialRune(1, SelectionStart))),
		wantRes: 0,
	}} {
		t.Run(tc.name, func(t *testing.T) {
			res := findTokenPosition(tc.uIdx, tc.ro, tc.text)
			if res != tc.wantRes {
				t.Errorf("findTokenPosition() returned wrong result, want: %v got: %v", tc.wantRes, res)
			}
		})
	}
}

func TestUpdateText(t *testing.T) {
	specialDate := time.Date(2015, 2, 13, 0, 0, 0, 0, time.UTC)

	for _, tc := range []struct {
		name     string
		s        *Session
		req      common.UpdateSessionRequest
		wantResp common.UpdateSessionResponse
	}{{
		name: "two_users_not_colliding",
		s: &Session{
			Text: "some text",
			Users: map[string]*common.User{
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
		req: common.UpdateSessionRequest{
			UserID:    "user_1",
			BaseText:  "some text",
			NewText:   "some texta",
			CursorPos: 10,
		},
		wantResp: common.UpdateSessionResponse{
			NewText: "some texta",
			Users: []*common.User{
				{
					ID:       "user_1",
					Position: 10,
					Index:    0,
					LastEdit: specialDate,
				},
				{
					ID:       "user_2",
					Position: 0,
					Index:    1,
					LastEdit: specialDate,
				},
			},
		},
	}, {
		name: "two_users_colliding",
		s: &Session{
			Text: "some text",
			Users: map[string]*common.User{
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
		req: common.UpdateSessionRequest{
			UserID:    "user_1",
			BaseText:  "some text",
			NewText:   "asome text",
			CursorPos: 1,
			Users: []*common.User{
				{
					ID:       "user_2",
					Position: 10,
				},
			},
		},
		wantResp: common.UpdateSessionResponse{
			NewText: "asome text",
			Users: []*common.User{
				{
					ID:       "user_1",
					Index:    0,
					Position: 1,
					LastEdit: specialDate,
				},
				{
					ID:       "user_2",
					Index:    1,
					Position: 10,
					LastEdit: specialDate,
				},
			},
		},
	}, {
		name: "merging_two_edits",
		s: &Session{
			Text: `
			edited by user 1
			edited by user 2 added
			`,
			Users: map[string]*common.User{
				"user_1": {
					ID:       "user_1",
					Index:    0,
					Position: 0,
					LastEdit: specialDate,
				},
				"user_2": {
					ID:       "user_2",
					Index:    1,
					Position: 30,
					LastEdit: specialDate,
				},
				"user_3": {
					ID:             "user_3",
					Index:          2,
					HasSelection:   true,
					SelectionStart: 20,
					SelectionEnd:   35,
					LastEdit:       specialDate,
				},
			},
		},
		req: common.UpdateSessionRequest{
			UserID: "user_1",
			BaseText: `
			edited by user 1
			edited by user 2
			`,
			NewText: `
			edited by user 1 added
			edited by user 2
			`,
			CursorPos: 24,
			Users: []*common.User{
				{
					ID:       "user_2",
					Position: 36,
				},
			},
		},
		wantResp: common.UpdateSessionResponse{
			NewText: `
			edited by user 1 added
			edited by user 2 added
			`,
			Users: []*common.User{
				{
					ID:       "user_1",
					Index:    0,
					Position: 24,
					LastEdit: specialDate,
				},
				{
					ID:       "user_2",
					Index:    1,
					Position: 36,
					LastEdit: specialDate,
				},
				{
					ID:             "user_3",
					Index:          2,
					HasSelection:   true,
					SelectionStart: 20,
					SelectionEnd:   41,
					LastEdit:       specialDate,
				},
			},
		},
	}} {
		t.Run(tc.name, func(t *testing.T) {
			nowSource = func() time.Time { return specialDate }
			resp := tc.s.Update(&tc.req)
			sort.Slice(resp.Users, func(i, j int) bool {
				return resp.Users[i].ID < resp.Users[j].ID
			})

			if diff := cmp.Diff(tc.wantResp, *resp); diff != "" {
				t.Errorf("Update returned wrong results, -want +got:\n%v", diff)
			}
		})
	}
}
