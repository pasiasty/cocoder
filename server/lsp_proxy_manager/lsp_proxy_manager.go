package lsp_proxy_manager

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/pasiasty/cocoder/server/users_manager"
)

type LSPProxyManager struct {
}

func New() *LSPProxyManager {
	return &LSPProxyManager{}
}

func pylsPath() string {
	absolute := "/usr/local/bin/pyls"
	shortcut := "pyls"

	if _, err := os.Stat(absolute); err == nil {
		return absolute
	}
	return shortcut
}

func initialCommand(language string) (*exec.Cmd, error) {

	switch language {
	case "python":
		return &exec.Cmd{
			Path: pylsPath(),
			Args: []string{
				"-v",
			},
		}, nil
	case "cpp":
		return &exec.Cmd{
			Path: "/usr/bin/clangd",
		}, nil
	case "go":
		return &exec.Cmd{
			Path: "./gopls",
			Args: []string{},
		}, nil
	}

	return nil, fmt.Errorf("language: %s is not supported", language)
}

type Connection struct {
	mux  sync.Mutex
	conn *websocket.Conn

	userID   users_manager.UserID
	language string

	stdin  io.Writer
	stdout *bufio.Reader

	process *os.Process
}

func (c *Connection) passToServerLoop(ctx context.Context) {
	defer c.close()

	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(10 * time.Millisecond):
			mt, msg, err := c.conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("Unexpected websocket error: %v", err)
				}
				return
			}
			if mt == websocket.PingMessage {
				c.mux.Lock()
				if err := c.conn.WriteMessage(websocket.PongMessage, nil); err != nil {
					log.Printf("Failed to write pong: %v", err)
				}
				c.mux.Unlock()
				continue
			}

			msgEnc := fmt.Sprintf("%v", string(msg))

			reqStanza := "Content-Length: %v\r\n" + "Content-Type: application/vscode-jsonrpc; charset=utf8\r\n\r\n%v"

			req := fmt.Sprintf(reqStanza, len(msgEnc), msgEnc)
			c.stdin.Write([]byte(req))
		}
	}
}

func (c *Connection) readFromServerLoop(ctx context.Context) {
	defer c.close()

	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(10 * time.Millisecond):
			line, err := c.stdout.ReadString('\n')
			if err != nil {
				log.Printf("Failed to read from stdout: %v\n", err)
			}
			prefix := "Content-Length: "
			if !strings.HasPrefix(line, prefix) {
				fmt.Printf("First line got unexpected format: %q\n", line)
				continue
			}
			respLen, err := strconv.ParseInt(strings.TrimSpace(line[len(prefix):]), 10, 32)
			if err != nil {
				fmt.Printf("Failed to parse content length: %v\n", err)
			}

			for strings.TrimSpace(line) != "" {
				line, err = c.stdout.ReadString('\n')
				if err != nil {
					break
				}
			}
			if err != nil {
				log.Printf("Failed while skipping headers: %v\n", err)
				continue
			}

			resp := make([]byte, respLen)

			if _, err := io.ReadFull(c.stdout, resp); err != nil {
				log.Printf("Failed to get the response: %v\n", err)
				continue
			}

			c.mux.Lock()
			if err := c.conn.WriteMessage(websocket.TextMessage, resp); err != nil {
				log.Printf("Failed to send the response to the websocket: %v\n", err)
				c.mux.Unlock()
				return
			}
			c.mux.Unlock()
		}
	}
}

func (c *Connection) close() {
	log.Printf("closing LSP connection for user: %q language: %q\n", c.userID, c.language)
	c.mux.Lock()
	defer c.mux.Unlock()

	c.process.Kill()
	c.conn.Close()
}

func (m *LSPProxyManager) Connect(ctx context.Context, conn *websocket.Conn, language string, userID users_manager.UserID) error {
	cmd, err := initialCommand(language)
	if err != nil {
		return err
	}

	c := &Connection{
		userID:   userID,
		language: language,
		conn:     conn,
	}

	stdoutReader, stdoutWriter := io.Pipe()
	cmd.Stdout = stdoutWriter
	c.stdout = bufio.NewReader(stdoutReader)

	stdinReader, stdinWriter := io.Pipe()
	cmd.Stdin = stdinReader
	c.stdin = stdinWriter

	cmd.Stderr = os.Stdout

	if err := cmd.Start(); err != nil {
		return err
	}

	c.process = cmd.Process

	go c.passToServerLoop(ctx)
	go c.readFromServerLoop(ctx)

	log.Printf("Opened LSP connection for user: %q language: %q\n", c.userID, c.language)
	return nil
}
