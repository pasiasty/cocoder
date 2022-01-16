package server

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type RouteManager struct {
	r  *gin.Engine
	sm *SessionManager
}

func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func NewRouterManager() *RouteManager {
	r := gin.Default()
	sm := NewSessionManager()

	r.Use(CORSMiddleware())

	r.GET("/new_session", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"sessionID": sm.NewSession(),
		})
	})

	r.GET("/:session_id", func(c *gin.Context) {
		sessionID := SessionID(c.Param("session_id"))

		if sm.SessionExists(sessionID) {
			c.String(http.StatusOK, "ok")
		} else {
			c.String(http.StatusNotFound, fmt.Sprintf("session '%s' not found", sessionID))
		}
	})

	r.POST("/:session_id/update_text", func(c *gin.Context) {
		sessionID := SessionID(c.Param("session_id"))
		baseText := c.PostForm("base_text")
		newText := c.PostForm("new_text")
		cursorPos, err := strconv.ParseInt(c.PostForm("cursor_pos"), 10, 32)
		if err != nil {
			c.String(http.StatusBadRequest, fmt.Sprintf("Failed to parse cursor_pos as integer (%v)", err))
			return
		}

		es, err := sm.UpdateSessionText(sessionID,
			EditState{
				BaseText:  baseText,
				NewText:   newText,
				CursorPos: int(cursorPos),
			})
		if err != nil {
			c.String(http.StatusInternalServerError, fmt.Sprintf("Failed to update session text: %v", err))
			return
		}
		c.JSON(200, gin.H{
			"new_text":   es.BaseText,
			"cursor_pos": es.CursorPos,
		})
	})

	return &RouteManager{
		r:  r,
		sm: sm,
	}
}

func (m *RouteManager) Router() *gin.Engine {
	return m.r
}
