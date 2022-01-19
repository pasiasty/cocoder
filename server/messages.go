package server

type UpdateSessionRequest struct {
	BaseText  string `form:"BaseText" diff:"base_text"`
	NewText   string `form:"NewText" diff:"new_text"`
	CursorPos int    `form:"CursorPos" diff:"cursor_pos"`
}

type UpdateSessionResponse struct {
	NewText   string `json:"NewText" diff:"new_text"`
	CursorPos int    `json:"CursorPos" diff:"cursor_pos"`
	WasMerged bool   `json:"WasMerged" diff:"was_merged"`
}
