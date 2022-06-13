package executor

import (
	"bytes"
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/pasiasty/cocoder/server/common"
	"github.com/pasiasty/cocoder/server/users_manager"
)

type Executor struct {
}

func New() *Executor {
	return &Executor{}
}

func initialCommand(ctx context.Context, language, filename string) (*exec.Cmd, error) {
	switch language {
	case "python":
		return exec.CommandContext(ctx, "python3", filename), nil
	}

	return nil, fmt.Errorf("language: %s is not supported", language)
}

func (e *Executor) Execute(ctx context.Context, userID users_manager.UserID, language, code, stdin string) (*common.ExecutionResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	f, err := ioutil.TempFile("", string(userID))
	if err != nil {
		return nil, err
	}
	defer os.Remove(f.Name())

	if _, err := f.WriteString(code); err != nil {
		return nil, err
	}

	cmd, err := initialCommand(ctx, language, f.Name())
	if err != nil {
		return nil, err
	}
	cmd.Stdin = strings.NewReader(stdin)
	stdoutBuf := &bytes.Buffer{}
	stderrBuf := &bytes.Buffer{}

	cmd.Stdout = stdoutBuf
	cmd.Stderr = stderrBuf

	if err := cmd.Run(); err != nil {
		if ctx.Err() != nil {
			return &common.ExecutionResponse{
				ErrorMessage: "Execution timed out",
			}, nil
		}
		return &common.ExecutionResponse{
			ErrorMessage: fmt.Sprintf("failed (%v)", err),
			Stdout:       stdoutBuf.String(),
			Stderr:       stderrBuf.String(),
		}, nil
	}

	return &common.ExecutionResponse{
		Stdout: stdoutBuf.String(),
		Stderr: stderrBuf.String(),
	}, nil
}
