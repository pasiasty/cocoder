package common

import "time"

type User struct {
	ID             string    `json:"ID" diff:"ID"`
	Index          int       `json:"Index" diff:"Index"`
	Position       int       `json:"Position" diff:"Position"`
	HasSelection   bool      `diff:"HasSelection" json:"HasSelection"`
	SelectionStart int       `diff:"SelectionStart" json:"SelectionStart"`
	SelectionEnd   int       `diff:"SelectionEnd" json:"SelectionEnd"`
	LastEdit       time.Time `json:"LastEdit" diff:"LastEdit"`
}

type UpdateSessionRequest struct {
	Ping           bool
	BaseText       string  `form:"BaseText" diff:"BaseText" json:"BaseText"`
	NewText        string  `form:"NewText" diff:"NewText" json:"NewText"`
	CursorPos      int     `form:"CursorPos" diff:"CursorPos" json:"CursorPos"`
	HasSelection   bool    `form:"HasSelection" diff:"HasSelection" json:"HasSelection"`
	SelectionStart int     `form:"SelectionStart" diff:"SelectionStart" json:"SelectionStart"`
	SelectionEnd   int     `form:"SelectionEnd" diff:"SelectionEnd" json:"SelectionEnd"`
	UserID         string  `form:"UserID" diff:"UserID" json:"UserID"`
	Language       string  `form:"Language" diff:"Language" json:"Language"`
	Users          []*User `json:"Users" diff:"users"`
}

type UpdateSessionResponse struct {
	Ping     bool
	NewText  string `json:"NewText" diff:"new_text"`
	Language string `json:"Language" diff:"language"`

	Users []*User `json:"Users" diff:"users"`
}

type UpdateLanguageRequest struct {
	Language string `form:"Language" diff:"language"`
}

type GetSessionResponse struct {
	Text     string `json:"Text" diff:"text"`
	Language string `json:"Language" diff:"language"`
}
