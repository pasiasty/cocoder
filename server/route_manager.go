package server

import (
	"fmt"
	"net/http"

	limits "github.com/gin-contrib/size"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis"
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

func NewRouterManager(c *redis.Client) *RouteManager {
	r := gin.Default()
	sm := NewSessionManager(c)

	r.Use(limits.RequestSizeLimiter(1024 * 1024))
	r.Use(CORSMiddleware())

	g := r.Group("/api")

	g.GET("/new_session", func(c *gin.Context) {
		c.String(http.StatusOK, fmt.Sprintf("%q", string(sm.NewSession())))
	})

	g.GET("/:session_id", func(c *gin.Context) {
		sessionID := SessionID(c.Param("session_id"))

		if text, err := sm.LoadSession(sessionID); err == nil {
			c.String(http.StatusOK, fmt.Sprintf("%q", text))
		} else {
			c.String(http.StatusNotFound, fmt.Sprintf("error while loading session: %v", err))
		}
	})

	g.POST("/:session_id", func(c *gin.Context) {
		sessionID := SessionID(c.Param("session_id"))

		req := &UpdateSessionRequest{}

		if err := c.ShouldBind(req); err != nil {
			c.AbortWithError(http.StatusBadRequest, err)
			return
		}

		resp, err := sm.UpdateSessionText(sessionID, req)
		if err != nil {
			c.String(http.StatusInternalServerError, fmt.Sprintf("Failed to update session text: %v", err))
			return
		}

		c.JSON(http.StatusOK, resp)
	})

	return &RouteManager{
		r:  r,
		sm: sm,
	}
}

func (m *RouteManager) Router() *gin.Engine {
	return m.r
}
