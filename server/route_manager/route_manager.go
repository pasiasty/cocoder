package route_manager

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gin-contrib/pprof"
	limits "github.com/gin-contrib/size"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis"
	"github.com/gorilla/websocket"

	"github.com/pasiasty/cocoder/server/common"
	"github.com/pasiasty/cocoder/server/executor"
	lsp_proxy "github.com/pasiasty/cocoder/server/lsp_proxy_manager"
	"github.com/pasiasty/cocoder/server/session_manager"
	"github.com/pasiasty/cocoder/server/users_manager"
)

var wsupgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

type RouteManager struct {
	r    *gin.Engine
	sm   *session_manager.SessionManager
	lspm *lsp_proxy.LSPProxyManager
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

func NewRouterManager(ctx context.Context, c *redis.Client) *RouteManager {
	r := gin.Default()
	pprof.Register(r)
	sm := session_manager.NewSessionManager(c)
	um := users_manager.NewUsersManager(ctx, sm)
	lspm := lsp_proxy.New()
	e := executor.New()

	r.Use(limits.RequestSizeLimiter(1024 * 1024))
	r.Use(CORSMiddleware())

	g := r.Group("/api")

	g.GET("/new_session", func(c *gin.Context) {
		c.String(http.StatusOK, fmt.Sprintf("%q", string(sm.NewSession())))
	})

	g.GET("/:session_id", func(c *gin.Context) {
		sessionID := session_manager.SessionID(c.Param("session_id"))

		if s, err := sm.LoadSession(sessionID); err == nil {
			c.JSON(http.StatusOK, s)
		} else {
			c.String(http.StatusNotFound, fmt.Sprintf("error while loading session: %v", err))
		}
	})

	g.GET("/:session_id/:user_id/session_ws", func(c *gin.Context) {
		sessionID := session_manager.SessionID(c.Param("session_id"))
		userID := users_manager.UserID(c.Param("user_id"))

		conn, err := wsupgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			c.AbortWithError(http.StatusInternalServerError, err)
			return
		}

		um.RegisterUser(c, sessionID, userID, conn)
	})

	g.GET("/lsp/:user_id/:language", func(c *gin.Context) {
		language := string(session_manager.SessionID(c.Param("language")))
		userID := users_manager.UserID(c.Param("user_id"))

		conn, err := wsupgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			c.AbortWithError(http.StatusInternalServerError, err)
			return
		}

		if err := lspm.Connect(c, conn, language, userID); err != nil {
			c.AbortWithError(http.StatusInternalServerError, err)
			conn.Close()
		}
	})

	g.POST("/execute/:session_id/:user_id/:language", func(c *gin.Context) {
		sessionID := session_manager.SessionID(c.Param("session_id"))
		userID := users_manager.UserID(c.Param("user_id"))
		language := string(session_manager.SessionID(c.Param("language")))

		code := c.PostForm("code")
		stdin := c.PostForm("stdin")

		resp, err := e.Execute(c, userID, language, code, stdin)
		if err != nil {
			fmt.Printf("Failed to execute: %v\n", err)
			c.AbortWithError(http.StatusInternalServerError, err)
			return
		}

		sm.UpdateSession(ctx, sessionID, &common.UpdateSessionRequest{
			UpdateOutputText:   true,
			Stdout:             resp.Stdout,
			Stderr:             resp.Stderr,
			UpdateRunningState: true,
			Running:            false,
		})
		c.JSON(http.StatusOK, resp)
	})

	g.POST("/format/:user_id/:language", func(c *gin.Context) {
		language := string(session_manager.SessionID(c.Param("language")))
		userID := users_manager.UserID(c.Param("user_id"))

		code := c.PostForm("code")

		resp, err := e.Format(c, userID, language, code)
		if err != nil {
			fmt.Printf("Failed to format: %v\n", err)
			c.AbortWithError(http.StatusInternalServerError, err)
			return
		}
		c.JSON(http.StatusOK, resp)
	})

	return &RouteManager{
		r:    r,
		sm:   sm,
		lspm: lspm,
	}
}

func (m *RouteManager) Router() *gin.Engine {
	return m.r
}

func (m *RouteManager) Dispose() {
	m.lspm.Dispose()
}
