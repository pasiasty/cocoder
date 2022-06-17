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

	UpdateInputText bool   `form:"UpdateInputText" diff:"UpdateInputText" json:"UpdateInputText"`
	InputText       string `form:"InputText" diff:"InputText" json:"InputText"`

	UpdateOutputText bool   `form:"UpdateOutputText" diff:"UpdateOutputText" json:"UpdateOutputText"`
	Stdout           string `form:"Stdout" diff:"Stdout" json:"Stdout"`
	Stderr           string `form:"Stderr" diff:"Stderr" json:"Stderr"`

	UpdateRunningState bool `form:"UpdateRunningState" diff:"UpdateRunningState" json:"UpdateRunningState"`
	Running            bool `form:"Running" diff:"Running" json:"Running"`
}

type UpdateSessionResponse struct {
	Ping     bool
	NewText  string  `json:"NewText" diff:"new_text"`
	Language string  `json:"Language" diff:"language"`
	Users    []*User `json:"Users" diff:"users"`

	UpdateInputText bool   `form:"UpdateInputText" diff:"UpdateInputText" json:"UpdateInputText"`
	InputText       string `form:"InputText" diff:"InputText" json:"InputText"`

	UpdateOutputText bool   `form:"UpdateOutputText" diff:"UpdateOutputText" json:"UpdateOutputText"`
	Stdout           string `form:"Stdout" diff:"Stdout" json:"Stdout"`
	Stderr           string `form:"Stderr" diff:"Stderr" json:"Stderr"`

	UpdateRunningState bool `form:"UpdateRunningState" diff:"UpdateRunningState" json:"UpdateRunningState"`
	Running            bool `form:"Running" diff:"Running" json:"Running"`
}

type UpdateLanguageRequest struct {
	Language string `form:"Language" diff:"language"`
}

type GetSessionResponse struct {
	Text     string `json:"Text" diff:"text"`
	Language string `json:"Language" diff:"language"`
}

type ExecutionResponse struct {
	ErrorMessage string `json:"ErrorMessage"`
	Stdout       string `json:"Stdout"`
	Stderr       string `json:"Stderr"`
}

type FormatResponse struct {
	Code string `json:"Code"`
}
